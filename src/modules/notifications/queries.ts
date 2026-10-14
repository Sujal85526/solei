import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import type { OutboxFilters } from "./schema";

export async function listTemplates() {
  const supabase = await createClient();
  return must(
    await supabase
      .from("notification_templates")
      .select("key, audience, channel, name, description, subject, enabled, sort, updated_at")
      .order("sort"),
    "templates",
  );
}

export async function getTemplate(key: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_templates")
    .select(
      "key, audience, channel, name, description, subject, body, variables, enabled, updated_at, updated_by",
    )
    .eq("key", key)
    .maybeSingle();
  return data;
}

/** Owner alert address (visible with settings.manage only — RLS). */
export async function ownerAlertEmail(): Promise<{ readable: boolean; email: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("private_settings")
    .select("owner_notification_email")
    .eq("id", 1)
    .maybeSingle();
  return { readable: !!data, email: data?.owner_notification_email ?? null };
}

export const OUTBOX_PAGE_SIZE = 50;

export async function listOutbox(filters: OutboxFilters) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  let q = supabase
    .from("notification_log")
    .select(
      "id, template_key, channel, recipient, subject, status, provider, error, order_id, created_at, orders(number)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * OUTBOX_PAGE_SIZE, page * OUTBOX_PAGE_SIZE - 1);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.template) q = q.eq("template_key", filters.template);
  if (filters.q) {
    const text = filters.q.replace(/[,()*%:"\\]/g, " ").trim();
    if (text) q = q.or(`recipient.ilike.*${text}*,subject.ilike.*${text}*`);
  }
  const res = await q;
  return { rows: must(res, "outbox"), total: res.count ?? 0, page };
}
