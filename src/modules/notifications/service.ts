import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { emailProvider, recipientAllowed } from "@/providers/email";
import { createNotifier, type NotifierDeps, type NotifyInput, type NotifyResult } from "./notifier";
import { sampleVars } from "./samples";
import { ownerEmailSchema, templateSchema, testSendSchema, toggleSchema } from "./schema";

export type { NotifyInput, NotifyResult } from "./notifier";

/** Wiring for the notifier: service-role client (sends happen in webhooks without a session). */
function notifier(overrides: Partial<NotifierDeps> = {}) {
  const admin = createAdminClient();
  return createNotifier({
    loadTemplate: async (k) => {
      const { data, error } = await admin
        .from("notification_templates")
        .select("subject, body, enabled")
        .eq("key", k)
        .maybeSingle();
      if (error) throw new Error(`template load failed: ${error.message}`);
      return data;
    },
    sentSince: async (k, dedupeKey, since) => {
      const { count, error } = await admin
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .eq("template_key", k)
        .eq("dedupe_key", dedupeKey)
        .neq("status", "failed")
        .gte("created_at", since.toISOString());
      if (error) throw new Error(`dedupe check failed: ${error.message}`);
      return (count ?? 0) > 0;
    },
    writeLog: async (row) => {
      const { error } = await admin.from("notification_log").insert(row);
      if (error) throw new Error(error.message);
    },
    provider: emailProvider,
    recipientAllowed,
    ...overrides,
  });
}

/** Send a templated notification (server-only). Never throws; every outcome is in the outbox. */
export function notify(key: string, input: NotifyInput): Promise<NotifyResult> {
  return notifier()(key, input);
}

/**
 * Send with content supplied by the caller instead of a stored template (email campaigns),
 * logged in the outbox under `key`. Same guards: allowlist, logging, never throws.
 */
export function notifyWithContent(
  key: string,
  content: { subject: string; body: string },
  input: NotifyInput,
): Promise<NotifyResult> {
  return notifier({ loadTemplate: async () => ({ ...content, enabled: true }) })(key, input);
}

/** The owner's alert address, or null when not set. */
export async function ownerEmail(): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("private_settings")
    .select("owner_notification_email")
    .eq("id", 1)
    .maybeSingle();
  return data?.owner_notification_email?.trim() || null;
}

// --- Admin: templates ----------------------------------------------------------------------

export async function saveTemplate(input: unknown) {
  const staff = await assertPermission("notifications.manage");
  const v = templateSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_templates")
    .update({ subject: v.subject, body: v.body, enabled: v.enabled, updated_by: staff.userId })
    .eq("key", v.key)
    .select("key");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new UserError("Template not found.");
}

export async function setTemplateEnabled(input: unknown) {
  const staff = await assertPermission("notifications.manage");
  const v = toggleSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_templates")
    .update({ enabled: v.enabled, updated_by: staff.userId })
    .eq("key", v.key);
  if (error) throw new Error(error.message);
  return v;
}

/** Send the (unsaved) draft to the signed-in staff member with sample values. */
export async function sendTest(input: unknown) {
  const staff = await assertPermission("notifications.manage");
  const v = testSendSchema.parse(input);
  if (!staff.email) throw new UserError("Your account has no email address.");
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("notification_templates")
    .select("variables")
    .eq("key", v.key)
    .maybeSingle();
  if (!t) throw new UserError("Template not found.");
  const result = await notifier({
    loadTemplate: async () => ({
      subject: `[Test] ${v.subject}`,
      body: v.body,
      enabled: true,
    }),
  })(v.key, {
    to: staff.email,
    vars: sampleVars(publicEnv.NEXT_PUBLIC_SITE_URL, t.variables),
  });
  if (result.status === "failed") throw new UserError(`Sending failed: ${result.reason}`);
  if (result.status === "skipped") throw new UserError(`Not sent: ${result.reason}.`);
  return { to: staff.email, provider: emailProvider().name };
}

export async function saveOwnerEmail(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = ownerEmailSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("private_settings")
    .update({ owner_notification_email: v.ownerEmail, updated_by: staff.userId })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
