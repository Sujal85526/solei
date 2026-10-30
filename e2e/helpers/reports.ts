import { adminClient } from "./auth";
import type { TestProduct } from "./catalog";

/**
 * A completed, cash-paid order for `qty` × the product, on a business day of our choosing,
 * created straight in the ledger with a known unit cost (the POS / manual order screens have their
 * own specs). `staffId` makes it count as that person's sale in Reports → Staff.
 */
export async function seedPaidOrder(
  product: TestProduct,
  opts: { day: string; qty: number; unitCostFils?: number; staffId?: string },
) {
  const admin = adminClient();
  const { data: variant } = await admin
    .from("product_variants")
    .select("id, sku, label, price_fils, products(name, category_id, destination_id)")
    .eq("id", product.variantId)
    .single();
  const p = variant!.products as unknown as {
    name: string;
    category_id: string;
    destination_id: string | null;
  };
  const total = variant!.price_fils * opts.qty;
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      channel: "direct",
      status: "completed",
      staff_id: opts.staffId ?? null,
      subtotal_fils: total,
      total_fils: total,
      vat_fils: 0,
      vat_rate_bp: 0,
      // Midday in Abu Dhabi, so the business day is `day` whatever the runner's time zone.
      placed_at: `${opts.day}T08:00:00Z`,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: line, error: e2 } = await admin
    .from("order_lines")
    .insert({
      order_id: order.id,
      variant_id: variant!.id,
      product_name: p.name,
      variant_label: variant!.label,
      sku: variant!.sku,
      category_id: p.category_id,
      destination_id: p.destination_id,
      qty: opts.qty,
      list_price_fils: variant!.price_fils,
      unit_price_fils: variant!.price_fils,
      line_total_fils: total,
    })
    .select("id")
    .single();
  if (e2) throw e2;
  if (opts.unitCostFils !== undefined)
    await admin
      .from("order_line_costs")
      .insert({ order_line_id: line.id, unit_cost_fils: opts.unitCostFils });
  const { error: e3 } = await admin
    .from("payments")
    .insert({ order_id: order.id, amount_fils: total, method: "cash", status: "succeeded" });
  if (e3) throw e3;
  return order.id as string;
}

/**
 * A business day years before any real sale, different per project and per run, so a one-day
 * report range holds only the rows a test creates (the test database is a copy of the live shop).
 */
export function quietDay(project: string) {
  const now = Date.now();
  const year = 2001 + (Math.floor(now / 1000) % 15);
  const month = { mobile: "02", tablet: "05", desktop: "08" }[project] ?? "11";
  const day = String(1 + (Math.floor(now / 60_000) % 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
