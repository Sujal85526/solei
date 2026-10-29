import "server-only";
import { businessDay, businessDayRange } from "@/lib/dates";
import { must } from "@/lib/supabase/must";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { searchNeedles, type OrderFilters } from "./schema";

export const ORDERS_PAGE_SIZE = 25;

const COLUMNS =
  "id, number, channel, status, payment_status, total_fils, outstanding_fils, paid_fils, refunded_fils, contact_name, contact_phone, placed_at, item_count, event_name, delivery_emirate, fulfilment";

export async function listOrders(filters: OrderFilters) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  let q = supabase
    .from("admin_orders")
    .select(COLUMNS, { count: "exact" })
    .order("placed_at", { ascending: false })
    .range((page - 1) * ORDERS_PAGE_SIZE, page * ORDERS_PAGE_SIZE - 1);

  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  // Abandoned website checkouts stay out of the default list (searching still finds them).
  else if (!filters.status && !filters.q) q = q.neq("status", "pending_payment");
  if (filters.payment) q = q.eq("payment_status", filters.payment);
  if (filters.event) q = q.eq("event_id", filters.event);
  if (filters.staff) q = q.eq("staff_id", filters.staff);
  if (filters.from) q = q.gte("placed_at", businessDayRange(filters.from).start.toISOString());
  if (filters.to) q = q.lt("placed_at", businessDayRange(filters.to).end.toISOString());
  if (filters.q) {
    const { text, phone } = searchNeedles(filters.q);
    const ors = [`number.ilike.*${text}*`, `contact_name.ilike.*${text}*`];
    if (phone) ors.push(`contact_phone.like.*${phone}*`);
    if (text || phone) q = q.or(ors.join(","));
  }
  const res = await q;
  return { rows: must(res, "orders"), total: res.count ?? 0, page };
}
export type OrderListRow = Awaited<ReturnType<typeof listOrders>>["rows"][number];

/** Stat chips: confirmed orders placed today (Asia/Dubai) and the unpaid balance on open orders. */
export async function orderStats() {
  const supabase = await createClient();
  const { start, end } = businessDayRange(businessDay());
  // One aggregate in the database (exact beyond the API's 1,000-row cap).
  const { data, error } = await supabase
    .rpc("admin_order_stats", {
      p_day_start: start.toISOString(),
      p_day_end: end.toISOString(),
    })
    .single();
  if (error) throw new Error(`order stats failed: ${error.message}`);
  return {
    todayCount: Number(data.today_count),
    todayRevenueFils: Number(data.today_revenue_fils),
    outstandingFils: Number(data.outstanding_fils),
    outstandingCount: Number(data.outstanding_count),
  };
}

/** Events for the list filter (newest first). */
export async function eventOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, start_date")
    .order("start_date", { ascending: false })
    .limit(100);
  return data ?? [];
}

/**
 * Staff names for the "Made by" filter (staff_profiles is readable with staff.manage only, so the
 * names are read with the service role after the orders.view check).
 */
export async function staffOptions(): Promise<{ id: string; name: string }[]> {
  await assertPermission("orders.view");
  const { data } = await createAdminClient()
    .from("staff_profiles")
    .select("user_id, full_name, active")
    .order("active", { ascending: false })
    .order("full_name");
  return (data ?? []).map((s) => ({ id: s.user_id, name: s.full_name }));
}

/** Everything the order detail page shows. Line costs come back empty without financial access (RLS). */
export async function getOrder(id: string) {
  const supabase = await createClient();
  // The order and its child rows only need `id`, so all six requests run at once.
  const orderQuery = supabase
    .from("orders")
    .select(
      "id, number, channel, status, fulfilment, customer_id, contact_name, contact_phone, contact_email, delivery_address, delivery_emirate, delivery_fee_fils, delivery_discount_fils, subtotal_fils, discount_fils, coupon_code, vat_fils, total_fils, vat_rate_bp, prices_include_vat, notes, internal_notes, tracking_number, courier, placed_at, created_at, cancelled_at, cancel_reason, event_id, event_day, staff_id, events(name)",
    )
    .eq("id", id)
    .maybeSingle();

  const [{ data: order }, lines, summary, payments, history, notifications] = await Promise.all([
    orderQuery,
    supabase
      .from("order_lines")
      .select(
        "id, variant_id, product_name, variant_label, sku, qty, list_price_fils, unit_price_fils, price_override_reason, discount_fils, line_total_fils, is_reward, options, created_at, order_line_costs(unit_cost_fils)",
      )
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("order_payment_summary")
      .select("paid_fils, refunded_fils, outstanding_fils, payment_status")
      .eq("order_id", id)
      .single(),
    supabase
      .from("payments")
      .select(
        "id, kind, amount_fils, method, status, provider, reference, note, received_by, received_at, created_at",
      )
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("order_status_history")
      .select("id, from_status, to_status, note, changed_by, created_at")
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("notification_log")
      .select("id, template_key, recipient, subject, status, provider, error, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!order) return null;

  return {
    order,
    lines: must(lines, "order lines").map((l) => ({
      ...l,
      unit_cost_fils: l.order_line_costs?.unit_cost_fils ?? null,
    })),
    summary: must(summary, "payment summary"),
    payments: must(payments, "payments"),
    history: must(history, "status history"),
    notifications: notifications.data ?? [],
  };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
