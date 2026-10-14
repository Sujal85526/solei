"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { formatAED } from "@/lib/money";
import { notifyOrderPaid, notifyOrderStatus, notifyPaymentReceived } from "./notify";
import * as orders from "./service";
import { ORDER_STATUS_LABELS } from "./status";

/** Storefront availability is cached under this tag (see T25). */
const STOCK_TAG = "stock";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

function refresh(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function changeStatusAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await orders.changeStatus(entries(fd));
    refresh(r.orderId);
    after(() => notifyOrderStatus(r.orderId, r.status));
    return ok(undefined, `Order marked ${ORDER_STATUS_LABELS[r.status].toLowerCase()}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function recordPaymentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await orders.recordPayment(entries(fd));
    refresh(r.orderId);
    if (r.newlyPaid) {
      // Completing an order deducts its stock.
      updateTag(STOCK_TAG);
      revalidatePath("/admin/inventory", "layout");
      after(() => notifyOrderPaid(r.orderId));
    } else {
      after(() => notifyPaymentReceived(r.orderId, r.amountFils));
    }
    return ok(
      undefined,
      r.outstandingFils > 0
        ? `Payment recorded. ${formatAED(r.outstandingFils)} still outstanding.`
        : "Payment recorded. The order is fully paid.",
    );
  } catch (e) {
    return fail(e);
  }
}

export async function recordRefundAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await orders.recordRefund(entries(fd));
    refresh(r.orderId);
    return ok(undefined, `Refund of ${formatAED(r.amountFils)} recorded.`);
  } catch (e) {
    return fail(e);
  }
}

export async function cancelOrderAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await orders.cancelOrder(entries(fd));
    refresh(r.orderId);
    if (r.restockedLines > 0) {
      updateTag(STOCK_TAG);
      revalidatePath("/admin/inventory", "layout");
    }
    return ok(
      undefined,
      r.restockedLines > 0 ? "Order cancelled and stock returned." : "Order cancelled.",
    );
  } catch (e) {
    return fail(e);
  }
}

export async function updateNotesAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const orderId = String(fd.get("orderId") ?? "");
    await orders.updateNotes(entries(fd));
    refresh(orderId);
    return ok(undefined, "Notes saved.");
  } catch (e) {
    return fail(e);
  }
}
