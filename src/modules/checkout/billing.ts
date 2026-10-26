import { emirateLabels, type Emirate } from "@/modules/customers/schema";
import type { BillingAddress } from "@/providers/payment/types";

type OrderContact = {
  contact_name: string | null;
  delivery_address: unknown;
  delivery_emirate: Emirate | null;
};

/**
 * Billing name and address for the payment page, from what checkout already collected: the
 * account name and the delivery address. City falls back to the emirate (event and manual orders
 * may have no address); the country is always the UAE.
 */
export function billingFromOrder(order: OrderContact): BillingAddress {
  const address = (
    order.delivery_address && typeof order.delivery_address === "object"
      ? order.delivery_address
      : {}
  ) as Partial<Record<"line1" | "line2" | "area" | "city" | "emirate", string | null>>;
  const [firstName = "", ...rest] = (order.contact_name ?? "").trim().split(/\s+/);
  const emirate = order.delivery_emirate ?? (address.emirate as Emirate | null | undefined);
  const emirateName = emirate && emirate in emirateLabels ? emirateLabels[emirate] : "";
  const city = address.city?.trim() || emirateName || "Abu Dhabi";
  return {
    firstName,
    lastName: rest.join(" "),
    address1: [address.line1, address.line2, address.area]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", "),
    city,
  };
}
