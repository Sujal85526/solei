import { describe, expect, it } from "vitest";
import { addressText, canBook, isOpen } from "@/modules/fulfilments/schema";
import { MockCourierProvider } from "./mock";

const courier = new MockCourierProvider();
const booked = new Date("2026-10-24T08:00:00Z");
const at = (hours: number) => new Date(booked.getTime() + hours * 3_600_000);

describe("stand-in courier", () => {
  it("books with a tracking number", async () => {
    const s = await courier.createShipment({
      orderNumber: "SOL-000123",
      recipient: {
        name: "Layla",
        phone: "+971501234567",
        address: "Villa 1",
        emirate: "Abu Dhabi",
      },
      pieces: 2,
      codFils: 0,
    });
    expect(s.trackingNumber).toMatch(/^MX\d{8}$/);
    expect(s.courier).toBe("Mock Express");
  });

  it("moves the parcel along a fixed timeline", async () => {
    expect((await courier.track("MX1", booked, at(0.5))).status).toBe("booked");
    expect((await courier.track("MX1", booked, at(2))).status).toBe("picked_up");
    expect((await courier.track("MX1", booked, at(10))).status).toBe("in_transit");
    expect((await courier.track("MX1", booked, at(25))).status).toBe("out_for_delivery");
    const done = await courier.track("MX1", booked, at(31));
    expect(done.status).toBe("delivered");
    expect(done.events.map((e) => e.status)).toEqual([
      "booked",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered",
    ]);
  });
});

describe("courier rules", () => {
  it("books delivery orders that are new or being prepared", () => {
    expect(canBook({ fulfilment: "delivery", status: "preparing" })).toBe(true);
    expect(canBook({ fulfilment: "delivery", status: "dispatched" })).toBe(false);
    expect(canBook({ fulfilment: "pickup", status: "new" })).toBe(false);
  });
  it("knows which parcels are still moving", () => {
    expect(isOpen("in_transit")).toBe(true);
    expect(isOpen("delivered")).toBe(false);
  });
  it("writes the address on one line", () => {
    expect(addressText({ line1: "Villa 12", area: "Al Bateen", city: "Abu Dhabi" })).toBe(
      "Villa 12, Al Bateen, Abu Dhabi",
    );
  });
});
