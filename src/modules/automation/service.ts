import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { feedbackLinkSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { currentAccount } from "@/modules/account/service";
import { labelRulesSchema } from "@/modules/customers/labels";
import { notify, ownerEmail } from "@/modules/notifications/service";
import { feedbackToken, verifyFeedbackToken, type FeedbackLinkPurpose } from "./links";
import { getAutomationSettings } from "./queries";
import {
  automationSettingsSchema,
  digestLines,
  eventDatesText,
  eventNewsSignupSchema,
  feedbackAnswerSchema,
  shiftTimeText,
  timeText,
} from "./schema";

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL;
const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || "there";

export const feedbackLink = (orderId: string, purpose: FeedbackLinkPurpose) =>
  `${site()}/feedback${purpose === "stop" ? "/stop" : ""}?o=${orderId}&t=${feedbackToken(orderId, purpose, feedbackLinkSecret())}`;

const rethrow = (error: { code?: string; message: string }): never => {
  if (["P0001", "P0002", "22023"].includes(error.code ?? "")) {
    throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1));
  }
  throw new Error(error.message);
};

// --- Settings ----------------------------------------------------------------------------------

export async function saveLabelRules(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = labelRulesSchema.parse(input);
  const { error } = await createAdminClient()
    .from("settings")
    .update({
      label_vip_spend_fils: v.vipSpend,
      label_vip_months: v.vipMonths,
      label_inactive_days: v.inactiveDays,
      label_new_days: v.newDays,
      label_returning_orders: v.returningOrders,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function saveAutomationSettings(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = automationSettingsSchema.parse(input);
  const { error } = await createAdminClient()
    .from("settings")
    .update({
      feedback_requests_enabled: v.feedbackEnabled,
      feedback_request_days: v.feedbackDays,
      staff_reminders_enabled: v.staffRemindersEnabled,
      staff_reminder_hours: v.staffReminderHours,
      owner_event_digest_enabled: v.ownerDigestEnabled,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

// --- Feedback requests -------------------------------------------------------------------------

/** The product page of the order's first line, to write a review (else the shop). */
async function reviewLink(orderId: string): Promise<string> {
  const { data } = await createAdminClient()
    .from("order_lines")
    .select("product_variants(products(slug))")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  const slug = (data as { product_variants: { products: { slug: string } | null } | null } | null)
    ?.product_variants?.products?.slug;
  return slug ? `${site()}/products/${slug}` : `${site()}/shop`;
}

/**
 * Email every delivered order that is due a feedback request (scheduler, daily, or the admin
 * button). Once per order: the request is recorded before sending, so a second run never asks
 * again, even when the email failed.
 */
export async function sendDueFeedbackRequests(): Promise<{ sent: number; skipped: number }> {
  const settings = await getAutomationSettings();
  if (!settings.feedbackEnabled) return { sent: 0, skipped: 0 };
  const admin = createAdminClient();
  const { data: due, error } = await admin.rpc("feedback_requests_due");
  if (error) throw new Error(`feedback_requests_due failed: ${error.message}`);
  let sent = 0;
  let skipped = 0;
  for (const o of due) {
    const { error: claim } = await admin
      .from("feedback_requests")
      .insert({ order_id: o.order_id, customer_id: o.customer_id, email: o.email });
    if (claim) {
      // Another run claimed it (23505) — not ours to send.
      skipped++;
      continue;
    }
    const result = await notify("feedback_request", {
      to: o.email,
      customerId: o.customer_id,
      orderId: o.order_id,
      dedupeKey: `feedback:${o.order_id}`,
      dedupeHours: 24 * 365,
      vars: {
        customer_name: firstName(o.name),
        order_number: o.order_number,
        feedback_link: feedbackLink(o.order_id, "answer"),
        review_link: await reviewLink(o.order_id),
        unsubscribe_link: feedbackLink(o.order_id, "stop"),
      },
    });
    if (result.status === "sent") sent++;
    else skipped++;
  }
  return { sent, skipped };
}

export async function runFeedbackRequestsNow() {
  await assertPermission("settings.manage");
  return sendDueFeedbackRequests();
}

/** The feedback page: which order it is about, and whether it was answered already. */
export async function feedbackRequestFromLink(orderId: string, token: string) {
  if (!verifyFeedbackToken(orderId, "answer", token, feedbackLinkSecret())) return null;
  const { data } = await createAdminClient()
    .from("feedback_requests")
    .select("answered_at, orders(number)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!data) return null;
  return {
    orderNumber: (data.orders as { number: string } | null)?.number ?? "",
    answered: Boolean(data.answered_at),
  };
}

export async function submitFeedbackFromLink(input: unknown) {
  const v = feedbackAnswerSchema.parse(input);
  if (!verifyFeedbackToken(v.orderId, "answer", v.token, feedbackLinkSecret())) {
    throw new UserError("This link isn't valid any more.");
  }
  const { error } = await createAdminClient().rpc("feedback_submit", {
    p_order: v.orderId,
    // No rating = null (the function takes all four arguments).
    p_rating: v.rating as number,
    p_kind: v.kind,
    p_message: v.message,
  });
  if (error) rethrow(error);
}

/** "Stop feedback emails" (a button on the page, so link scanners can't trigger it). */
export async function stopFeedbackFromLink(orderId: string, token: string) {
  if (!verifyFeedbackToken(orderId, "stop", token, feedbackLinkSecret())) {
    throw new UserError("This link isn't valid any more.");
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("feedback_requests")
    .select("customer_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!data?.customer_id) return;
  const { error } = await admin
    .from("customers")
    .update({ feedback_optout_at: new Date().toISOString() })
    .eq("id", data.customer_id)
    .is("feedback_optout_at", null);
  if (error) throw new Error(error.message);
}

// --- Staff reminders ---------------------------------------------------------------------------

/**
 * Remind staff of events they're assigned to and their planned shifts, `staffReminderHours`
 * ahead (scheduler, hourly). Each reminder goes once (outbox dedupe); a moved shift is a new one.
 */
export async function sendStaffReminders(): Promise<{ sent: number; skipped: number }> {
  const settings = await getAutomationSettings();
  if (!settings.staffRemindersEnabled) return { sent: 0, skipped: 0 };
  const { data: due, error } = await createAdminClient().rpc("staff_reminders_due", {
    p_hours: settings.staffReminderHours,
  });
  if (error) throw new Error(`staff_reminders_due failed: ${error.message}`);
  let sent = 0;
  let skipped = 0;
  for (const r of due) {
    const place = [r.location].filter(Boolean).join(", ") || "see the event page";
    const result =
      r.kind === "event"
        ? await notify("staff_event_reminder", {
            to: r.email,
            dedupeKey: `staff-event:${r.event_id}:${r.user_id}`,
            dedupeHours: 24 * 30,
            vars: {
              staff_name: firstName(r.full_name),
              event_name: r.event_name,
              event_role: r.role ? ` as ${r.role}` : "",
              event_dates: eventDatesText(r.start_date, r.end_date),
              start_time: timeText(r.starts_at),
              event_location: place,
              note: r.note ?? "",
              event_link: `${site()}/admin/calendar/events/${r.event_id}`,
            },
          })
        : await notify("staff_shift_reminder", {
            to: r.email,
            dedupeKey: `staff-shift:${r.ref_id}:${r.starts_at}`,
            dedupeHours: 24 * 30,
            vars: {
              staff_name: firstName(r.full_name),
              shift_date: eventDatesText(
                businessDay(new Date(r.starts_at)),
                businessDay(new Date(r.starts_at)),
              ),
              shift_time: shiftTimeText(r.starts_at, r.ends_at),
              event_name: r.event_name ? ` at ${r.event_name}` : "",
              note: r.note ?? "",
              rota_link: `${site()}/admin/attendance/rota`,
            },
          });
    if (result.status === "sent") sent++;
    else skipped++;
  }
  return { sent, skipped };
}

export async function runStaffRemindersNow() {
  await assertPermission("settings.manage");
  return sendStaffReminders();
}

/** Daily digest of the next 7 days' events and who is working, to the owner's alert address. */
export async function sendOwnerEventDigest(): Promise<{ sent: number; skipped: number }> {
  const settings = await getAutomationSettings();
  if (!settings.ownerDigestEnabled) return { sent: 0, skipped: 0 };
  const to = await ownerEmail();
  if (!to) return { sent: 0, skipped: 1 };
  const today = businessDay();
  const until = new Date(`${today}T12:00:00+04:00`);
  until.setUTCDate(until.getUTCDate() + 6);
  const { data, error } = await createAdminClient()
    .from("events")
    .select("name, start_date, end_date, location, event_staff(staff_profiles(full_name))")
    .neq("status", "cancelled")
    .lte("start_date", businessDay(until))
    .gte("end_date", today)
    .order("start_date");
  if (error) throw new Error(error.message);
  const events = (
    data as unknown as {
      name: string;
      start_date: string;
      end_date: string;
      location: string | null;
      event_staff: { staff_profiles: { full_name: string } | null }[];
    }[]
  ).map((e) => ({
    name: e.name,
    startDate: e.start_date,
    endDate: e.end_date,
    location: e.location,
    staff: e.event_staff.flatMap((s) => (s.staff_profiles ? [s.staff_profiles.full_name] : [])),
  }));
  if (!events.length) return { sent: 0, skipped: 1 };
  const result = await notify("owner_event_digest", {
    to,
    dedupeKey: `event-digest:${today}`,
    dedupeHours: 20,
    vars: { events: digestLines(events), calendar_link: `${site()}/admin/calendar` },
  });
  return result.status === "sent" ? { sent: 1, skipped: 0 } : { sent: 0, skipped: 1 };
}

// --- Event news --------------------------------------------------------------------------------

/** Public sign-up on the events page (creates the customer when new). */
export async function joinEventNews(input: unknown) {
  const v = eventNewsSignupSchema.parse(input);
  const { error } = await createAdminClient().rpc("event_news_opt_in", {
    p_email: v.email,
    p_name: v.name ?? undefined,
  });
  if (error) rethrow(error);
}

/** The signed-in customer's own switch (Account → Emails). */
export async function setMyEventNews(on: boolean) {
  const account = await currentAccount();
  if (!account?.user.email) throw new UserError("Please sign in.");
  const admin = createAdminClient();
  if (on) {
    const { error } = await admin.rpc("event_news_opt_in", { p_email: account.user.email });
    if (error) rethrow(error);
    return;
  }
  const { error } = await admin
    .from("customers")
    .update({ event_news: false })
    .eq("email", account.user.email.toLowerCase());
  if (error) throw new Error(error.message);
}

/** Is the signed-in customer on the event news list? */
export async function myEventNews(): Promise<boolean> {
  const account = await currentAccount();
  if (!account?.user.email) return false;
  const { data } = await createAdminClient()
    .from("customers")
    .select("id")
    .eq("email", account.user.email.toLowerCase())
    .eq("event_news", true)
    .limit(1);
  return Boolean(data?.length);
}

/** Staff record (or withdraw) a customer's wish to hear about events. */
export async function setCustomerEventNews(customerId: string, on: boolean) {
  await assertPermission("customers.manage");
  const { error } = await createAdminClient()
    .from("customers")
    .update({ event_news: on, event_news_at: on ? new Date().toISOString() : null })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

/**
 * Start an announcement for a calendar event: a draft campaign to the event news subscribers,
 * pre-filled from the `event_announcement` template. Returns the campaign id (the owner reviews
 * and sends it from the campaign page).
 */
export async function announceEvent(eventId: string): Promise<string> {
  const staff = await assertPermission("marketing.manage");
  const admin = createAdminClient();
  const [{ data: event }, { data: template }] = await Promise.all([
    admin
      .from("events")
      .select("id, name, start_date, end_date, location, status")
      .eq("id", eventId)
      .maybeSingle(),
    admin
      .from("notification_templates")
      .select("subject, body")
      .eq("key", "event_announcement")
      .maybeSingle(),
  ]);
  if (!event) throw new UserError("Event not found.");
  if (event.status === "cancelled") throw new UserError("This event is cancelled.");
  // Event details are filled in now; {{first_name}} and the unsubscribe link stay per customer.
  const fill = (text: string) =>
    text
      .replaceAll("{{event_name}}", event.name)
      .replaceAll("{{event_dates}}", eventDatesText(event.start_date, event.end_date))
      .replaceAll("{{event_location}}", event.location ?? "");
  const { data, error } = await admin
    .from("campaigns")
    .insert({
      name: `Event: ${event.name}`,
      subject: fill(template?.subject ?? "Come and see us at {{event_name}}"),
      body: fill(template?.body ?? ""),
      audience: "event_news",
      event_id: event.id,
      created_by: staff.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}
