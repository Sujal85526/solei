import "server-only";
import { assertPermission } from "@/lib/auth/session";
import type { Database } from "@/lib/database.types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
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
  oncePerCustomer: r.once_per_customer,
  minOrderFils: r.min_order_fils,
  productIds: r.product_ids,
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

/** Products a coupon can be limited to (active and hidden, so a future launch can be prepared). */
export async function listCouponProducts(): Promise<
  { id: string; name: string; active: boolean }[]
> {
  await assertPermission("coupons.manage");
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, active")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export type CouponCheck =
  | { ok: true; couponId: string; code: string; discountFils: number }
  | { ok: false; reason: CouponRefusal; minOrderFils: number | null };

/**
 * Check a code against a bag (prices from the catalogue) for a customer email. Used by the
 * checkout summary and before placing the order; `create_web_order` checks again.
 */
export async function checkCoupon(
  code: string,
  lines: { variantId: string; qty: number }[],
  email: string | null,
): Promise<CouponCheck> {
  const { data, error } = await createAdminClient().rpc("coupon_evaluate", {
    p_code: code,
    p_lines: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
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
  };
  return r.ok
    ? { ok: true, couponId: r.coupon_id!, code: r.code!, discountFils: r.discount_fils! }
    : { ok: false, reason: r.reason ?? "invalid", minOrderFils: r.min_order_fils ?? null };
}
