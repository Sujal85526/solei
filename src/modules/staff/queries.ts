import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";

export async function listStaff() {
  const supabase = await createClient();
  return must(
    await supabase
      .from("staff_profiles")
      .select(
        "user_id, full_name, email, position, phone, employment_status, active, created_at, roles(id, key, name)",
      )
      .order("active", { ascending: false })
      .order("full_name"),
    "staff",
  );
}

export async function getStaff(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select(
      "user_id, full_name, email, position, phone, employment_status, active, deactivated_at, created_at, role_id, roles(key, name)",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function listRoles() {
  const supabase = await createClient();
  const [roles, perms, staff] = await Promise.all([
    supabase
      .from("roles")
      .select("id, key, name, description, requires_mfa, is_system")
      .order("created_at"),
    supabase.from("role_permissions").select("role_id, permission_key"),
    supabase.from("staff_profiles").select("role_id").eq("active", true),
  ]);
  const rows = must(roles, "roles");
  const grants = must(perms, "role permissions");
  const staffRows = staff.data ?? [];
  return rows.map((r) => ({
    ...r,
    permissions: grants.filter((g) => g.role_id === r.id).map((g) => g.permission_key),
    staffCount: staffRows.filter((s) => s.role_id === r.id).length,
  }));
}

export type AuditFilters = {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
};
export const AUDIT_PAGE_SIZE = 50;

export async function listAudit(filters: AuditFilters) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let q = supabase
    .from("audit_log")
    .select("id, actor_id, action, entity, entity_id, before, after, ip, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE - 1);
  if (filters.actor) q = q.eq("actor_id", filters.actor);
  if (filters.action) q = q.ilike("action", `${filters.action}%`);
  if (filters.from) q = q.gte("created_at", `${filters.from}T00:00:00+04:00`);
  if (filters.to) q = q.lt("created_at", `${filters.to}T23:59:59.999+04:00`);
  const res = await q;
  return { rows: must(res, "audit log"), total: res.count ?? 0, page };
}

export async function staffDirectory() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("user_id, full_name")
    .order("full_name");
  return new Map((data ?? []).map((s) => [s.user_id, s.full_name]));
}
