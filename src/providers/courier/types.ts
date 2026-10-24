/**
 * Courier booking and tracking. One interface so a UAE courier's API (Aramex, Quiqup, Fetchr…)
 * can replace the stand-in without touching the callers.
 */
export type ShipmentStatus =
  "booked" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed" | "cancelled";

export type ShipmentRequest = {
  orderNumber: string;
  recipient: {
    name: string;
    phone: string | null;
    address: string;
    emirate: string | null;
  };
  /** Number of items (couriers price by parcel size; one bag for a perfume order). */
  pieces: number;
  /** Cash to collect on delivery, if any (fils). */
  codFils: number;
};

export type Shipment = {
  courier: string;
  trackingNumber: string;
  /** Printable label from the courier, when it gives one. */
  labelUrl: string | null;
};

export type TrackingEvent = { at: string; status: ShipmentStatus; description: string };

export type Tracking = { status: ShipmentStatus; events: TrackingEvent[] };

export interface CourierProvider {
  readonly name: string;
  createShipment(request: ShipmentRequest): Promise<Shipment>;
  /** `bookedAt` lets stand-ins simulate progress; real couriers ignore it. */
  track(trackingNumber: string, bookedAt: Date): Promise<Tracking>;
}
