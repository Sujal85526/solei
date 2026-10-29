import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { unsubscribeSecret } from "@/lib/env.server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notifyWithContent } from "@/modules/notifications/service";
import { unsubscribeToken, verifyUnsubscribeToken } from "./links";
import { emailableMembers, eventNewsMembers, getCampaign, getSegment } from "./queries";
import { campaignFormSchema, readyToSend, segmentFormSchema, withFooter } from "./schema";

const unsubscribeLink = (customerId: string) =>
  `${publicEnv.NEXT_PUBLIC_SITE_URL}/unsubscribe?c=${customerId}&t=${unsubscribeToken(customerId, unsubscribeSecret())}`;

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || "there";

/** Create or update a segment. Returns its id. */
export async function saveSegment(input: unknown): Promise<string> {
  const staff = await assertPermission("marketing.manage");
  const v = segmentFormSchema.parse(input);
  const supabase = await createClient();
  const row = { name: v.name, description: v.description, rules: v.rules };
  const { data, error } = v.id
    ? await supabase.from("customer_segments").update(row).eq("id", v.id).select("id").single()
    : await supabase
        .from("customer_segments")
        .insert({ ...row, created_by: staff.userId })
        .select("id")
        .single();
  if (error) {
    if (error.code === "23505") throw new UserError(`There is already a segment called ${v.name}.`);
    throw new Error(error.message);
  }
  return data.id;
}

/** Campaigns that used it keep its name on record. */
export async function deleteSegment(id: string) {
  await assertPermission("marketing.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("customer_segments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Save a draft. Sent campaigns can't be edited. Returns the id. */
export async function saveCampaign(input: unknown): Promise<string> {
  const staff = await assertPermission("marketing.manage");
  const v = campaignFormSchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    subject: v.subject,
    body: v.body,
    segment_id: v.segmentId ?? null,
  };
  if (v.id) {
    const { data, error } = await supabase
      .from("campaigns")
      .update(row)
      .eq("id", v.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new UserError("This campaign was already sent.");
    return data.id;
  }
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...row, created_by: staff.userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteCampaign(id: string) {
  await assertPermission("marketing.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("Sent campaigns are kept on record.");
}

/** Send the draft to the staff member's own email, with their name filled in. */
export async function sendTestCampaign(id: string) {
  const staff = await assertPermission("marketing.manage");
  const c = await getCampaign(id);
  if (!c) throw new UserError("Campaign not found.");
  if (!c.subject.trim() || !c.body.trim())
    throw new UserError("Write the subject and email first.");
  const result = await notifyWithContent(
    "campaign",
    { subject: `[Test] ${c.subject}`, body: withFooter(c.body, c.audience) },
    {
      to: staff.email,
      vars: {
        first_name: firstName(staff.name),
        unsubscribe_link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/unsubscribe`,
      },
    },
  );
  if (result.status !== "sent")
    throw new UserError(`Test not sent: ${result.reason ?? result.status}.`);
  return staff.email;
}

/**
 * Send a campaign to every customer in its segment who can be emailed. Safe to run again: the
 * recipient list is fixed when sending starts and only unsent recipients are tried (a "Resume
 * sending" after an interruption). Every email carries the recipient's own unsubscribe link.
 */
export async function sendCampaign(
  id: string,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const staff = await assertPermission("marketing.manage");
  const c = await getCampaign(id);
  if (!c) throw new UserError("Campaign not found.");
  if (c.status === "sent") throw new UserError("This campaign was already sent.");
  const admin = createAdminClient();

  if (c.status === "draft") {
    const problem = readyToSend(c);
    if (problem) throw new UserError(problem);
    let audienceName = "Event news subscribers";
    let audience: { customerId: string; email: string | null }[];
    if (c.audience === "event_news") {
      audience = await eventNewsMembers();
      if (!audience.length) throw new UserError("Nobody has asked for event news yet.");
    } else {
      const segment = await getSegment(c.segmentId!);
      if (!segment) throw new UserError("Its segment was deleted — choose another.");
      audienceName = segment.name;
      audience = await emailableMembers(segment.rules);
      if (!audience.length) throw new UserError("Nobody in this segment can be emailed.");
    }

    // Claim the draft (a second click finds it no longer a draft).
    const { data: claimed } = await admin
      .from("campaigns")
      .update({ status: "sending", segment_name: audienceName, sent_by: staff.userId })
      .eq("id", id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (!claimed) throw new UserError("This campaign is already being sent.");

    const { error } = await admin.from("campaign_recipients").upsert(
      audience.map((m) => ({ campaign_id: id, customer_id: m.customerId, email: m.email! })),
      { onConflict: "campaign_id,customer_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`campaign recipients failed: ${error.message}`);
  }

  const { data: pending, error } = await admin
    .from("campaign_recipients")
    .select("id, customer_id, email, customers(name, unsubscribed_at, event_news)")
    .eq("campaign_id", id)
    .eq("status", "pending")
    .order("id");
  if (error) throw new Error(error.message);

  const content = { subject: c.subject, body: withFooter(c.body, c.audience) };
  const tally = { sent: 0, failed: 0, skipped: 0 };
  for (const r of pending) {
    const now = new Date().toISOString();
    // Unsubscribed since sending started.
    const optedOut =
      c.audience === "event_news" ? !r.customers?.event_news : r.customers?.unsubscribed_at;
    if (!r.customer_id || optedOut) {
      await admin
        .from("campaign_recipients")
        .update({ status: "skipped", error: "Unsubscribed" })
        .eq("id", r.id);
      tally.skipped++;
      continue;
    }
    const result = await notifyWithContent("campaign", content, {
      to: r.email,
      customerId: r.customer_id,
      dedupeKey: `campaign:${id}:${r.customer_id}`,
      dedupeHours: 24 * 365,
      vars: {
        first_name: firstName(r.customers?.name ?? null),
        unsubscribe_link: unsubscribeLink(r.customer_id),
      },
    });
    const status = result.status;
    await admin
      .from("campaign_recipients")
      .update({
        status,
        error: result.reason ?? null,
        sent_at: status === "sent" ? now : null,
      })
      .eq("id", r.id);
    tally[status]++;
  }

  await admin
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  return tally;
}

/** The unsubscribe page's button (a button, so link scanners can't unsubscribe anyone). */
export async function unsubscribeFromLink(customerId: string, token: string) {
  if (!verifyUnsubscribeToken(customerId, token, unsubscribeSecret())) {
    throw new UserError("This link isn't valid any more.");
  }
  const { error } = await createAdminClient().rpc("customer_unsubscribe", {
    p_customer: customerId,
  });
  if (error) throw new Error(error.message);
}
