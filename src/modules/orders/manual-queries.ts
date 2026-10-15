import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";

export type SellableVariant = {
  id: string;
  label: string;
  productName: string;
  destination: string | null;
  sku: string;
  priceFils: number;
  onHand: number;
};

/** Active variants with on-hand at the online/default stock locations, for the manual order form. */
export async function sellableVariants(): Promise<SellableVariant[]> {
  const supabase = await createClient();
  const [variants, locations] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, label, sku, price_fils, products!inner(name, active, sort, destinations(name))")
      .eq("active", true)
      .eq("products.active", true),
    supabase.from("stock_locations").select("id").eq("sells_online", true).eq("active", true),
  ]);
  const online = (locations.data ?? []).map((l) => l.id);
  // Only the online locations' levels (bounded: variants × a few locations), not every level.
  const levels = online.length
    ? await supabase.from("stock_levels").select("variant_id, on_hand").in("location_id", online)
    : { data: [] };
  const onHand = new Map<string, number>();
  for (const l of levels.data ?? []) {
    if (!l.variant_id) continue;
    onHand.set(l.variant_id, (onHand.get(l.variant_id) ?? 0) + (l.on_hand ?? 0));
  }
  return must(variants, "variants")
    .map((v) => ({
      id: v.id,
      label: v.label,
      productName: v.products.name,
      destination: v.products.destinations?.name ?? null,
      sku: v.sku,
      priceFils: v.price_fils,
      onHand: onHand.get(v.id) ?? 0,
      sort: v.products.sort,
    }))
    .sort((a, b) => a.sort - b.sort || a.productName.localeCompare(b.productName))
    .map(({ sort: _sort, ...v }) => v);
}

export async function deliveryZones() {
  const supabase = await createClient();
  return must(
    await supabase
      .from("delivery_zones")
      .select("emirate, name, fee_fils")
      .eq("active", true)
      .order("sort"),
    "zones",
  );
}

export async function paymentLinksFor(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_links")
    .select("id, amount_fils, url, status, expires_at, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type OutstandingCustomer = {
  customerId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  totalOutstandingFils: number;
  oldestDays: number;
  orders: {
    id: string;
    number: string;
    outstandingFils: number;
    totalFils: number;
    placedAt: string;
    channel: string;
  }[];
};

/**
 * Unpaid balances on confirmed orders (manual, POS, payment-link, booking). Abandoned website
 * checkouts (still `pending_payment`) are not debts and are excluded.
 */
export async function outstandingByCustomer(now = new Date()): Promise<OutstandingCustomer[]> {
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("admin_orders")
      .select(
        "id, number, channel, status, customer_id, contact_name, contact_phone, contact_email, total_fils, outstanding_fils, placed_at",
      )
      .gt("outstanding_fils", 0)
      .not("status", "in", "(cancelled,pending_payment)")
      .order("placed_at", { ascending: true }),
    "outstanding orders",
  );
  const groups = new Map<string, OutstandingCustomer>();
  for (const r of rows) {
    const key = r.customer_id ?? `order:${r.id}`;
    const g =
      groups.get(key) ??
      ({
        customerId: r.customer_id,
        name: r.contact_name ?? "Walk-in customer",
        phone: r.contact_phone,
        email: r.contact_email,
        totalOutstandingFils: 0,
        oldestDays: 0,
        orders: [],
      } satisfies OutstandingCustomer);
    const days = Math.max(
      0,
      Math.floor((now.getTime() - new Date(r.placed_at ?? now).getTime()) / 86_400_000),
    );
    g.totalOutstandingFils += r.outstanding_fils ?? 0;
    g.oldestDays = Math.max(g.oldestDays, days);
    g.orders.push({
      id: r.id ?? "",
      number: r.number ?? "",
      outstandingFils: r.outstanding_fils ?? 0,
      totalFils: r.total_fils ?? 0,
      placedAt: r.placed_at ?? "",
      channel: r.channel ?? "",
    });
    groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) => b.oldestDays - a.oldestDays || b.totalOutstandingFils - a.totalOutstandingFils,
  );
}
