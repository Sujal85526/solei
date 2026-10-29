import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
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
    per_customer_limit: v.perCustomerLimit,
    // Kept in step for the live site (main) until the old flag is dropped after the merge.
    once_per_customer: v.perCustomerLimit === 1,
    min_order_fils: v.minOrder,
    product_ids: v.productIds,
    category_ids: v.categoryIds,
    buy_qty: v.buyQty,
    get_qty: v.getQty,
    combinable: v.combinable,
    channels: v.channels,
    event_id: v.eventId ?? null,
    tier_ids: v.tierIds,
    segment_id: v.segmentId ?? null,
    active: v.active,
    // Who may use it: the segment's customers as they are now (null = leave as it is: a birthday
    // code keeps its customer).
    ...(await customersFor(v.segmentId, v.id)),
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
    if (error.code === "23505")
      throw new UserError(`There is already a promotion with the code ${v.code}.`);
    throw new Error(error.message);
  }
  return data.id;
}

/**
 * The customers a code is for: everyone in its segment today (a snapshot — "Save" again to
 * refresh), nobody in particular without a segment, or unchanged for a birthday code.
 */
async function customersFor(
  segmentId: string | undefined,
  couponId: string | undefined,
): Promise<{ customer_ids?: string[] }> {
  const admin = createAdminClient();
  if (!segmentId) {
    if (couponId) {
      const { data } = await admin
        .from("coupons")
        .select("birthday_customer_id")
        .eq("id", couponId)
        .maybeSingle();
      if (data?.birthday_customer_id) return {};
    }
    return { customer_ids: [] };
  }
  const { data: segment, error } = await admin
    .from("customer_segments")
    .select("rules")
    .eq("id", segmentId)
    .single();
  if (error) throw new UserError("That segment no longer exists.");
  const { data: members, error: e2 } = await admin.rpc("segment_members", {
    p_rules: segment.rules,
  });
  if (e2) throw new Error(`segment_members failed: ${e2.message}`);
  if (!members.length) throw new UserError("That segment has no customers yet.");
  return { customer_ids: members.map((m) => m.customer_id) };
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
