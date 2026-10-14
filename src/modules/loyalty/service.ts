import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission, PermissionError, resolveStaff } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  adjustStampsSchema,
  issuePassportSchema,
  loyaltySettingsSchema,
  redeemRewardSchema,
  toRulePayload,
} from "./schema";

/*
 * Loyalty writes go through security-definer RPCs (permission check + validation + ledger write +
 * audit in one transaction). These wrappers add the app-side permission check and zod parsing.
 */

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "P0001" || error.code === "22023" || error.code === "P0002") {
    throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  }
  throw new Error(error.message);
}

export async function saveSettings(input: unknown) {
  await assertPermission("loyalty.manage");
  const v = loyaltySettingsSchema.parse(input);
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("loyalty_rule_versions")
    .select("id")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase.rpc("loyalty_save_rules", { p: toRulePayload(v) });
  if (error) dbError(error);
  return { ruleVersionId: data, newVersion: data !== before?.id };
}

export async function adjustStamps(input: unknown) {
  await assertPermission("loyalty.adjust");
  const v = adjustStampsSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_adjust_stamps", {
    p_customer_id: v.customerId,
    p_stamps: v.direction === "add" ? v.stamps : -v.stamps,
    p_reason: v.reason,
    p_destination_id: v.destinationId,
  });
  if (error) dbError(error);
  return { customerId: v.customerId, balance: data };
}

export async function issuePassport(input: unknown) {
  await assertPermission("loyalty.adjust");
  const v = issuePassportSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_issue_passport", {
    p_customer_id: v.customerId,
    p_how: v.how,
  });
  if (error) dbError(error);
  return { customerId: v.customerId, number: data };
}

/** Staff with loyalty.adjust (admin) or pos.use (event till) can redeem. */
async function assertCanRedeem() {
  const gate = await resolveStaff();
  if (
    gate.status !== "ok" ||
    !(can(gate.staff.permissions, "loyalty.adjust") || can(gate.staff.permissions, "pos.use"))
  ) {
    throw new PermissionError("loyalty.adjust");
  }
  return gate.staff;
}

export async function redeemReward(input: unknown) {
  await assertCanRedeem();
  const v = redeemRewardSchema.parse(input);
  const supabase = await createClient();
  let orderId: string | undefined;
  if (v.orderNumber) {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("number", v.orderNumber)
      .maybeSingle();
    if (!order) throw new UserError(`Order ${v.orderNumber} not found.`);
    orderId = order.id;
  }
  const { data, error } = await supabase
    .rpc("loyalty_redeem_reward", {
      p_reward_id: v.rewardId,
      p_variant_id: v.variantId,
      p_order_id: orderId,
      p_note: v.note || undefined,
    })
    .single();
  if (error) dbError(error);
  return { customerId: v.customerId, orderId: data.order_id, orderNumber: data.order_number };
}
