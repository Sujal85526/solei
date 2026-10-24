import { randomInt } from "node:crypto";
import type { CourierProvider, ShipmentRequest, Tracking, TrackingEvent } from "./types";

/** Hours after booking at which the stand-in courier reaches each step. */
const STEPS: [number, TrackingEvent["status"], string][] = [
  [0, "booked", "Shipment booked"],
  [1, "picked_up", "Picked up from Solei"],
  [4, "in_transit", "At the sorting hub"],
  [24, "out_for_delivery", "Out for delivery"],
  [30, "delivered", "Delivered"],
];

/**
 * Stand-in courier until a real account exists: books instantly with a made-up tracking number
 * and "moves" the parcel along a fixed timeline (picked up after 1 h, delivered after 30 h), so the
 * admin flow can be tried end to end.
 */
export class MockCourierProvider implements CourierProvider {
  readonly name = "mock";

  async createShipment(request: ShipmentRequest) {
    void request;
    return {
      courier: "Mock Express",
      trackingNumber: `MX${String(randomInt(10_000_000, 99_999_999))}`,
      labelUrl: null,
    };
  }

  async track(trackingNumber: string, bookedAt: Date, now = new Date()): Promise<Tracking> {
    void trackingNumber;
    const hours = (now.getTime() - bookedAt.getTime()) / 3_600_000;
    const reached = STEPS.filter(([h]) => hours >= h);
    const events = reached.map(([h, status, description]) => ({
      at: new Date(bookedAt.getTime() + h * 3_600_000).toISOString(),
      status,
      description,
    }));
    return { status: reached[reached.length - 1][1], events };
  }
}
