import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { emailProvider, recipientAllowed } from "@/providers/email";
import { createNotifier, type NotifyInput, type NotifyResult } from "./notifier";

export type { NotifyInput, NotifyResult } from "./notifier";

/**
 * Send a templated notification (server-only; uses the service-role client because sends happen
 * in webhooks and background work without a staff session). Never throws.
 */
export function notify(key: string, input: NotifyInput): Promise<NotifyResult> {
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
  })(key, input);
}

/** The owner's alert address (Admin → Settings), or null when not set. */
export async function ownerEmail(): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("private_settings")
    .select("owner_notification_email")
    .eq("id", 1)
    .maybeSingle();
  return data?.owner_notification_email?.trim() || null;
}
