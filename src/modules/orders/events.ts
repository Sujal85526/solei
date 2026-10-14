import "server-only";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { checkLowStock, notifyOrderPaid, notifyPaymentFailed } from "./notify";

/**
 * Side effects after an order becomes fully paid (called once per order by the webhook handler,
 * POS and manual payments). Emails go out after the response so a slow provider never delays
 * a webhook acknowledgement; loyalty hooks in here later.
 */
export async function onOrderPaid(order: { id: string; number: string }) {
  // Stock changed — refresh storefront availability.
  revalidateTag("stock", "max");
  after(() => notifyOrderPaid(order.id));
}

/** An online payment attempt failed or expired; the order stays open for a retry. */
export async function onPaymentFailed(orderId: string) {
  after(() => notifyPaymentFailed(orderId));
}

/** Stock went down outside a sale (damage, correction, transfer to an event). */
export function onStockReduced(variantIds: string[]) {
  after(() => checkLowStock(variantIds));
}
