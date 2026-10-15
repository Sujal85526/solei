import "server-only";
import { orderLinkSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { orderToken } from "@/modules/checkout/order-link";
import type { OrderStatus } from "@/modules/orders/status";
import { currentAccount } from "./service";

/** How an order's status reads to the customer. */
export const CUSTOMER_ORDER_STATUS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  new: "Confirmed",
  preparing: "Preparing",
  dispatched: "On its way",
  delivered: "Delivered",
  completed: "Delivered",
  cancelled: "Cancelled",
};

export type AccountOrder = {
  id: string;
  number: string;
  placedAt: string;
  status: OrderStatus;
  totalFils: number;
  items: number;
  href: string;
};

/**
 * The signed-in customer's profile and order history: orders placed while signed in
 * (`app_metadata.order_ids`) plus those of the customer record linked to the account (passport).
 * Read with the admin client after the session check — orders have no customer-facing RLS.
 */
export async function getAccountOverview() {
  const account = await currentAccount();
  if (!account) return null;
  const { user, meta } = account;
  const admin = createAdminClient();
  const ids = (user.app_metadata?.order_ids as string[] | undefined) ?? [];
  const { data: customer } = await admin
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const filters = [
    ids.length ? `id.in.(${ids.join(",")})` : null,
    customer ? `customer_id.eq.${customer.id}` : null,
  ].filter(Boolean);
  let orders: AccountOrder[] = [];
  if (filters.length) {
    const { data, error } = await admin
      .from("orders")
      .select("id, number, placed_at, status, total_fils, order_lines(qty)")
      .or(filters.join(","))
      .order("placed_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(`account orders failed: ${error.message}`);
    const secret = orderLinkSecret();
    orders = (data ?? []).map((o) => ({
      id: o.id,
      number: o.number,
      placedAt: o.placed_at,
      status: o.status,
      totalFils: o.total_fils,
      items: o.order_lines.reduce((s, l) => s + l.qty, 0),
      href: `/order/${o.number}?t=${orderToken(o.id, secret)}`,
    }));
  }
  return { email: user.email!, meta, orders };
}
