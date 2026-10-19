import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { couponFormSchema, dayBounds } from "./schema";

/** Create or update a coupon. Audited by trigger. Returns the coupon id. */
export async function saveCoupon(input: unknown): Promise<string> {
  const staff = await assertPermission("coupons.manage");
  const v = couponFormSchema.parse(input);
  const row = {
    code: v.code,
    description: v.description,
    kind: v.kind,
    percent_bp: v.percentBp,
    amount_fils: v.amountFils,
    ...dayBounds(v.startsOn, v.endsOn),
    max_uses: v.maxUses,
    once_per_customer: v.oncePerCustomer,
    min_order_fils: v.minOrder,
    product_ids: v.productIds,
    active: v.active,
  };
  const supabase = await createClient();
  const { data, error } = v.id
    ? await supabase.from("coupons").update(row).eq("id", v.id).select("id").single()
    : await supabase
        .from("coupons")
        .insert({ ...row, created_by: staff.userId })
        .select("id")
        .single();
  if (error) {
    if (error.code === "23505") throw new UserError(`There is already a coupon called ${v.code}.`);
    throw new Error(error.message);
  }
  return data.id;
}

export async function setCouponActive(id: string, active: boolean) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Orders that used it keep the code on record (`orders.coupon_code`). */
export async function deleteCoupon(id: string) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
