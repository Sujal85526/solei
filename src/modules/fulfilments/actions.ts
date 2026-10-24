"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { notifyOrderStatus } from "@/modules/orders/notify";
import { SHIPMENT_STATUS_LABELS } from "./schema";
import { bookCourier, refreshTracking } from "./service";

export async function bookCourierAction(orderId: string): Promise<ActionResult> {
  try {
    const tracking = await bookCourier(orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    after(() => notifyOrderStatus(orderId, "dispatched"));
    return ok(
      undefined,
      `Booked — tracking ${tracking}. The customer has been told it's on its way.`,
    );
  } catch (e) {
    return fail(e);
  }
}

export async function refreshTrackingAction(
  orderId: string,
  fulfilmentId: string,
): Promise<ActionResult> {
  try {
    const status = await refreshTracking(fulfilmentId);
    revalidatePath(`/admin/orders/${orderId}`);
    return ok(undefined, `Courier says: ${SHIPMENT_STATUS_LABELS[status]}.`);
  } catch (e) {
    return fail(e);
  }
}
