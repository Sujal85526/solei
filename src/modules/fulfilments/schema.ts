import type { ShipmentStatus } from "@/providers/courier/types";

/** Courier bookings: wording and the small rules shared by the admin and the tracking refresh. */

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
  cancelled: "Cancelled",
};

/** Still moving — worth asking the courier again. */
export const isOpen = (s: ShipmentStatus) => !["delivered", "failed", "cancelled"].includes(s);

/** An order can be booked with a courier while it's being got ready for delivery. */
export const canBook = (o: { fulfilment: string; status: string }) =>
  o.fulfilment === "delivery" && (o.status === "new" || o.status === "preparing");

/** "Villa 12, Street 4, Al Bateen, Abu Dhabi" from the stored address. */
export function addressText(address: unknown): string {
  const a = (address ?? {}) as Record<string, string | undefined>;
  return [a.line1, a.line2, a.area, a.city].filter(Boolean).join(", ");
}
