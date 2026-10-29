import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { progress } from "@/modules/loyalty/engine";
import { notify } from "@/modules/notifications/service";
import { stampsLine } from "./welcome-text";

/*
 * The "welcome to the website" email for customers the team entered by hand (past Instagram and
 * WhatsApp buyers). Staff send it from the customer page, or in batches from the customers list,
 * once the customer's stickers are in. The template is owner-editable (Notifications); who has
 * already been welcomed is read from `notification_log`, so nobody gets it twice by accident.
 */

const KEY = "customer_welcome";
/** Customers added by staff — not website sign-ups, newsletter or event-booking contacts. */
const HAND_ENTERED = ["manual", "whatsapp", "direct"] as const;
/** Emails per click: keeps one request short and well inside the email provider's rate limit. */
export const WELCOME_BATCH = 20;

async function lastSent(customerId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("notification_log")
    .select("created_at")
    .eq("template_key", KEY)
    .eq("customer_id", customerId)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ?? null;
}

/** When this customer was last sent the welcome email (null = never). */
export async function welcomeSentAt(customerId: string): Promise<string | null> {
  await assertPermission("customers.view");
  return lastSent(customerId);
}

async function loadRule() {
  const { data } = await createAdminClient()
    .from("loyalty_rule_versions")
    .select("stamps_for_reward, reward_label")
    .lte("effective_from", new Date().toISOString())
    .order("effective_from", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new UserError("The passport rules aren't set up yet (Admin → Loyalty).");
  return data;
}

/** Sticker progress + reward for a welcome email (0 stickers when there's no customer record yet). */
export async function stickerFacts(customerId: string | null) {
  const rule = await loadRule();
  const { data } = customerId
    ? await createAdminClient()
        .from("loyalty_balances")
        .select("balance")
        .eq("customer_id", customerId)
        .maybeSingle()
    : { data: null };
  return { p: progress(data?.balance ?? 0, rule.stamps_for_reward), reward: rule.reward_label };
}

/** Send one welcome email. `force` sends again even if one went out before. */
export async function sendWelcome(customerId: string, opts: { force?: boolean } = {}) {
  await assertPermission("customers.manage");
  const admin = createAdminClient();
  const { data: c } = await admin
    .from("customers")
    .select("id, name, email, unsubscribed_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!c) throw new UserError("Customer not found.");
  if (!c.email) throw new UserError("Add this customer's email first — the welcome goes by email.");
  if (c.unsubscribed_at) throw new UserError("This customer has opted out of messages from us.");
  // Our own "already welcomed?" check (only real sends count — a blocked or skipped attempt must
  // not stop the real one), instead of the notifier's dedupe, which treats skipped rows as sent.
  if (!opts.force && (await lastSent(c.id))) {
    throw new UserError("The welcome email was already sent to this customer.");
  }

  const { p, reward } = await stickerFacts(c.id);
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;

  const result = await notify(KEY, {
    to: c.email,
    customerId: c.id,
    vars: {
      customer_name: c.name?.trim() || "there",
      customer_email: c.email,
      stamps: p.collected,
      stamps_for_reward: p.total,
      remaining: p.remaining,
      reward,
      stamps_line: stampsLine(p, reward),
      shop_link: `${site}/shop`,
      passport_link: `${site}/passport`,
    },
  });
  if (result.status === "failed") throw new UserError(`Sending failed: ${result.reason}`);
  if (result.status === "skipped") throw new UserError(`Not sent: ${result.reason}.`);
}

/** Hand-entered customers with an email who haven't had the welcome yet (oldest first). */
async function pendingWelcome() {
  const admin = createAdminClient();
  const [{ data: customers }, { data: log }] = await Promise.all([
    admin
      .from("customers")
      .select("id")
      .in("source", [...HAND_ENTERED])
      .not("email", "is", null)
      .is("unsubscribed_at", null)
      .order("created_at"),
    admin
      .from("notification_log")
      .select("customer_id, status")
      .eq("template_key", KEY)
      .in("status", ["sent", "failed"]),
  ]);
  const done = new Set((log ?? []).filter((r) => r.status === "sent").map((r) => r.customer_id));
  const failedBefore = new Set(
    (log ?? []).filter((r) => r.status === "failed").map((r) => r.customer_id),
  );
  const todo = (customers ?? []).map((c) => c.id).filter((id) => !done.has(id));
  // Addresses that bounced go last, so one bad address can't hold up the rest of the batch.
  return [
    ...todo.filter((id) => !failedBefore.has(id)),
    ...todo.filter((id) => failedBefore.has(id)),
  ];
}

export async function pendingWelcomeCount(): Promise<number> {
  await assertPermission("customers.manage");
  return (await pendingWelcome()).length;
}

export type BatchResult = { sent: number; failed: number; remaining: number };

/** Send the welcome to the next batch of customers who haven't had it. */
export async function sendWelcomeBatch(): Promise<BatchResult> {
  await assertPermission("customers.manage");
  const todo = await pendingWelcome();
  let sent = 0;
  let failed = 0;
  for (const id of todo.slice(0, WELCOME_BATCH)) {
    try {
      await sendWelcome(id);
      sent++;
    } catch (e) {
      console.error("welcome email failed", id, e);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { sent, failed, remaining: Math.max(0, todo.length - sent - failed) };
}
