import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Side effects after an order becomes fully paid (called once per order by the webhook handler,
 * POS and manual payments). Notifications and loyalty hook in here in later milestones.
 */
export async function onOrderPaid(order: { id: string; number: string }) {
  // Stock changed — refresh storefront availability.
  revalidateTag("stock", "max");
  void order;
}
