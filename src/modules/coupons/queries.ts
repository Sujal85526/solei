import "server-only";
import { assertPermission } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { toDbOptions, type LineOptions } from "@/modules/catalog/options";
import { storedDays, type Coupon, type CouponRefusal } from "./schema";

type Row = Database["public"]["Tables"]["coupons"]["Row"];

const toCoupon = (r: Row): Coupon => ({
  id: r.id,
  code: r.code,
  description: r.description,
  kind: r.kind,
  percentBp: r.percent_bp,
  amountFils: r.amount_fils,
  ...storedDays(r.starts_at, r.ends_at),
  maxUses: r.max_uses,
  // Coupons set up on the live site (main) only have the old once-per-customer flag.
  perCustomerLimit: r.per_customer_limit ?? (r.once_per_customer ? 1 : null),
  minOrderFils: r.min_order_fils,
  productIds: r.product_ids,
  categoryIds: r.category_ids,
  active: r.active,
  createdAt: r.created_at,
});

export type CouponUsage = { uses: number; discountFils: number };

/** Uses and discount given per coupon, counted in the database (`coupon_usage()`). */
async function usage(): Promise<Map<string, CouponUsage>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("coupon_usage");
  if (error) throw new Error(error.message);
  return new Map(data.map((u) => [u.coupon_id, { uses: u.uses, discountFils: u.discount_fils }]));
}

export async function listCoupons(): Promise<(Coupon & CouponUsage)[]> {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const [{ data, error }, used] = await Promise.all([
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    usage(),
  ]);
  if (error) throw new Error(error.message);
  return data.map((r) => ({ ...toCoupon(r), ...(used.get(r.id) ?? { uses: 0, discountFils: 0 }) }));
}

export async function getCoupon(id: string): Promise<(Coupon & CouponUsage) | null> {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const [{ data, error }, used] = await Promise.all([
    supabase.from("coupons").select("*").eq("id", id).maybeSingle(),
    usage(),
  ]);
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { ...toCoupon(data), ...(used.get(id) ?? { uses: 0, discountFils: 0 }) };
}

export type ScopeOption = { id: string; name: string; active: boolean };

/**
 * Categories and products a promotion can be limited to (hidden ones too, so a future launch can
 * be prepared).
 */
export async function listPromotionScope(): Promise<{
  categories: ScopeOption[];
  products: ScopeOption[];
}> {
  await assertPermission("coupons.manage");
  const admin = createAdminClient();
  const [categories, products] = await Promise.all([
    admin.from("categories").select("id, name, active").order("sort").order("name"),
    admin.from("products").select("id, name, active").order("name"),
  ]);
  if (categories.error) throw new Error(categories.error.message);
  if (products.error) throw new Error(products.error.message);
  return { categories: categories.data, products: products.data };
}

/** Id → name for scope labels. */
export const scopeNames = (s: { categories: ScopeOption[]; products: ScopeOption[] }) =>
  new Map([...s.categories, ...s.products].map((o) => [o.id, o.name]));

export type PromotionReportRow = {
  code: string;
  couponId: string | null;
  orders: number;
  discountFils: number;
  deliveryDiscountFils: number;
  salesFils: number;
};

/** Paid orders that used a code between two business days (inclusive), per code. */
export async function promotionReport(from: string, to: string): Promise<PromotionReportRow[]> {
  await assertPermission("reports.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promotion_report", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    code: r.code,
    couponId: r.coupon_id,
    orders: r.orders,
    discountFils: r.discount_fils,
    deliveryDiscountFils: r.delivery_discount_fils,
    salesFils: r.sales_fils,
  }));
}

export type CouponCheck =
  | { ok: true; couponId: string; code: string; discountFils: number; freeDelivery: boolean }
  | { ok: false; reason: CouponRefusal; minOrderFils: number | null };

/**
 * Check a code against a bag (prices from the catalogue) for a customer email. Used by the
 * checkout summary and before placing the order; `create_web_order` checks again.
 */
export async function checkCoupon(
  code: string,
  lines: { variantId: string; qty: number; options?: LineOptions }[],
  email: string | null,
): Promise<CouponCheck> {
  const { data, error } = await createAdminClient().rpc("coupon_evaluate", {
    p_code: code,
    p_lines: lines.map((l) => ({
      variant_id: l.variantId,
      qty: l.qty,
      options: toDbOptions(l.options),
    })),
    // null = not signed in yet: the once-per-customer rule is checked again when ordering.
    p_email: email as string,
  });
  if (error) throw new Error(`coupon_evaluate failed: ${error.message}`);
  const r = data as {
    ok: boolean;
    reason?: CouponRefusal;
    min_order_fils?: number;
    coupon_id?: string;
    code?: string;
    discount_fils?: number;
    free_delivery?: boolean;
  };
  return r.ok
    ? {
        ok: true,
        couponId: r.coupon_id!,
        code: r.code!,
        discountFils: r.discount_fils!,
        freeDelivery: r.free_delivery === true,
      }
    : { ok: false, reason: r.reason ?? "invalid", minOrderFils: r.min_order_fils ?? null };
}
