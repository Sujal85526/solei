"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  createManualOrder,
  createPaymentLink,
  sendPaymentReminder,
  type PaymentLinkResult,
} from "./manual";

export async function createManualOrderAction(
  input: unknown,
): Promise<ActionResult<{ orderId: string; number: string; outstandingFils: number }>> {
  try {
    const res = await createManualOrder(input);
    updateTag("stock");
    revalidatePath("/admin/orders", "layout");
    return ok(res, `Order ${res.number} created.`);
  } catch (e) {
    return fail(e);
  }
}

export async function createPaymentLinkAction(
  orderId: string,
  amountFils?: number,
): Promise<ActionResult<PaymentLinkResult>> {
  try {
    const res = await createPaymentLink(orderId, amountFils);
    revalidatePath(`/admin/orders/${orderId}`);
    return ok(res, "Payment link ready.");
  } catch (e) {
    return fail(e);
  }
}

export async function sendReminderAction(
  orderId: string,
): Promise<ActionResult<PaymentLinkResult & { emailed: boolean }>> {
  try {
    const res = await sendPaymentReminder(orderId);
    revalidatePath("/admin/orders/outstanding");
    return ok(
      res,
      res.emailed ? "Reminder emailed — WhatsApp is ready too." : "Payment link ready to send.",
    );
  } catch (e) {
    return fail(e);
  }
}
