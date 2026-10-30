import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { must } from "@/lib/supabase/must";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { FeedbackEntry, FeedbackFilters } from "./schema";
import { hiddenStaffIds } from "@/modules/staff/hidden";

export const FEEDBACK_PAGE_SIZE = 25;

const COLUMNS =
  "id, customer_id, order_id, kind, source, rating, message, status, assigned_to, resolution, resolved_at, created_at, customers(name, email), orders(number)";

type Row = {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  kind: FeedbackEntry["kind"];
  source: FeedbackEntry["source"];
  rating: number | null;
  message: string;
  status: FeedbackEntry["status"];
  assigned_to: string | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  customers: { name: string | null; email: string | null } | null;
  orders: { number: string } | null;
};

const toEntry = (r: Row): FeedbackEntry => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.customers?.name ?? r.customers?.email ?? null,
  orderId: r.order_id,
  orderNumber: r.orders?.number ?? null,
  kind: r.kind,
  source: r.source,
  rating: r.rating,
  message: r.message,
  status: r.status,
  assignedTo: r.assigned_to,
  resolution: r.resolution,
  resolvedAt: r.resolved_at,
  createdAt: r.created_at,
});

/** The log, newest first, with filters. `assigned: "me"` = the signed-in staff member. */
export async function listFeedback(f: FeedbackFilters) {
  const staff = await assertPermission("customers.view");
  const supabase = await createClient();
  let q = supabase.from("customer_feedback").select(COLUMNS, { count: "exact" });
  if (f.status) q = q.eq("status", f.status);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.assigned) q = q.eq("assigned_to", f.assigned === "me" ? staff.userId : f.assigned);
  const res = await q
    .order("created_at", { ascending: false })
    .range((f.page - 1) * FEEDBACK_PAGE_SIZE, f.page * FEEDBACK_PAGE_SIZE - 1);
  return {
    rows: (must(res, "feedback") as unknown as Row[]).map(toEntry),
    total: res.count ?? 0,
  };
}

/** One customer's entries (profile page). */
export async function customerFeedback(customerId: string): Promise<FeedbackEntry[]> {
  await assertPermission("customers.view");
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("customer_feedback")
      .select(COLUMNS)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100),
    "customer feedback",
  );
  return (rows as unknown as Row[]).map(toEntry);
}

/** Counts per status (list page header). */
export async function feedbackCounts(): Promise<{ open: number; inProgress: number }> {
  await assertPermission("customers.view");
  const supabase = await createClient();
  const count = async (status: "open" | "in_progress") => {
    const { count } = await supabase
      .from("customer_feedback")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    return count ?? 0;
  };
  const [open, inProgress] = await Promise.all([count("open"), count("in_progress")]);
  return { open, inProgress };
}

/**
 * Staff names to assign entries to and to show who has one. Names only, after the permission
 * check (staff_profiles itself is readable with staff.manage only).
 */
export async function assignableStaff(): Promise<{ id: string; name: string; active: boolean }[]> {
  await assertPermission("customers.view");
  const [{ data }, hidden] = await Promise.all([
    createAdminClient()
      .from("staff_profiles")
      .select("user_id, full_name, active")
      .order("full_name"),
    hiddenStaffIds(),
  ]);
  return (data ?? [])
    .filter((s) => !hidden.has(s.user_id))
    .map((s) => ({ id: s.user_id, name: s.full_name, active: s.active }));
}
