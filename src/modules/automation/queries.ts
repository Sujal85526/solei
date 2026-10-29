import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_LABEL_RULES, type LabelRules } from "@/modules/customers/labels";
import type { AutomationSettings } from "./schema";

/** Label rules (settings are public-readable; read with the service role for cron use too). */
export async function getLabelRules(): Promise<LabelRules> {
  const { data } = await createAdminClient()
    .from("settings")
    .select(
      "label_vip_spend_fils, label_vip_months, label_inactive_days, label_new_days, label_returning_orders",
    )
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_LABEL_RULES;
  return {
    vipSpendFils: data.label_vip_spend_fils,
    vipMonths: data.label_vip_months,
    inactiveDays: data.label_inactive_days,
    newDays: data.label_new_days,
    returningOrders: data.label_returning_orders,
  };
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const { data, error } = await createAdminClient()
    .from("settings")
    .select(
      "feedback_requests_enabled, feedback_request_days, staff_reminders_enabled, staff_reminder_hours, owner_event_digest_enabled",
    )
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return {
    feedbackEnabled: data.feedback_requests_enabled,
    feedbackDays: data.feedback_request_days,
    staffRemindersEnabled: data.staff_reminders_enabled,
    staffReminderHours: data.staff_reminder_hours,
    ownerDigestEnabled: data.owner_event_digest_enabled,
  };
}

/** Numbers for the settings page: requests sent / answered (30 days), event news subscribers. */
export async function automationStats() {
  await assertPermission("settings.manage");
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [sent, answered, subscribers] = await Promise.all([
    admin
      .from("feedback_requests")
      .select("order_id", { count: "exact", head: true })
      .gte("sent_at", since),
    admin
      .from("feedback_requests")
      .select("order_id", { count: "exact", head: true })
      .gte("sent_at", since)
      .not("answered_at", "is", null),
    admin.from("customers").select("id", { count: "exact", head: true }).eq("event_news", true),
  ]);
  return {
    feedbackSent: sent.count ?? 0,
    feedbackAnswered: answered.count ?? 0,
    eventNewsSubscribers: subscribers.count ?? 0,
  };
}
