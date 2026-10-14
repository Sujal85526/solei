import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import {
  cancelSchema,
  notesSchema,
  paymentSchema,
  refundSchema,
  statusSchema,
} from "./schema";
import { ORDER_STATUS_LABELS, type OrderStatus } from "./status";

/**
 * Order management. Each call checks the permission here (clear error) and again in Postgres
 * (the RPCs run `require_permission`, lock the order row and write the audit log).
 * Calls run as the signed-in user so `auth.uid()` is recorded on payments and history.
 */

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "P0002") throw new UserError("Order not found.");
  if (error.code === "P0001" || error.code === "22023") {
    const msg = error.message
      .replace(/\((-?\d+) fils\)/g, (_, f: string) => `(${formatAED(Number(f))})`)
      .replace(
        /from (\w+) to (\w+)/,
        (_, a: string, b: string) =>
          `from ${ORDER_STATUS_LABELS[a as OrderStatus] ?? a} to ${ORDER_STATUS_LABELS[b as OrderStatus] ?? b}`,
      );
    throw new UserError(msg.charAt(0).toUpperCase() + msg.slice(1) + (msg.endsWith(".") ? "" : "."));
  }
  throw new Error(error.message);
}

export async function changeStatus(input: unknown) {
  await assertPermission("orders.update");
  const v = statusSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: v.orderId,
    p_status: v.status,
    p_note: v.note,
    p_tracking_number: v.trackingNumber,
    p_courier: v.courier,
  });
  if (error) dbError(error);
  return { orderId: v.orderId, status: v.status };
}

export async function recordPayment(input: unknown) {
  await assertPermission("payments.record");
  const v = paymentSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("record_payment", {
      p_order_id: v.orderId,
      p_amount_fils: v.amount,
      p_method: v.method,
      p_reference: v.reference,
      p_note: v.note,
    })
    .single();
  if (error) dbError(error);
  return {
    orderId: v.orderId,
    amountFils: v.amount,
    newlyPaid: data.newly_paid,
    outstandingFils: data.outstanding_fils,
  };
}

export async function recordRefund(input: unknown) {
  await assertPermission("orders.refund");
  const v = refundSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_refund", {
    p_order_id: v.orderId,
    p_amount_fils: v.amount,
    p_method: v.method,
    p_reason: v.reason,
  });
  if (error) dbError(error);
  return { orderId: v.orderId, amountFils: v.amount };
}

export async function cancelOrder(input: unknown) {
  await assertPermission("orders.cancel");
  const v = cancelSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order", {
    p_order_id: v.orderId,
    p_reason: v.reason,
    p_restock: v.restock,
  });
  if (error) dbError(error);
  return { orderId: v.orderId, restockedLines: data ?? 0 };
}

export async function updateNotes(input: unknown) {
  await assertPermission("orders.update");
  const v = notesSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_notes", {
    p_order_id: v.orderId,
    p_internal_notes: v.internalNotes,
  });
  if (error) dbError(error);
}
