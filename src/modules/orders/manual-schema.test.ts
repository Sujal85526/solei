import { describe, expect, it } from "vitest";
import { manualOrderSchema, paymentLinkMessage, waLink } from "./manual-schema";

const u = "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";
const base = {
  clientUuid: u,
  channel: "whatsapp",
  customerId: u,
  fulfilment: "handed_over",
  lines: [{ variantId: u, qty: 2, unitPriceFils: 28000, listPriceFils: 28000 }],
  payment: { mode: "later" },
};

describe("manual order schema", () => {
  it("takes an Instagram order, but not an order from a channel staff can't enter", () => {
    expect(manualOrderSchema.safeParse({ ...base, channel: "instagram" }).success).toBe(true);
    expect(manualOrderSchema.safeParse({ ...base, channel: "pos" }).success).toBe(false);
  });

  it("accepts a simple order", () => {
    expect(manualOrderSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a giveaway-only order and refuses an empty one", () => {
    const giveawayLines = [
      { variantId: u, qty: 150, giveawayId: u, options: [{ groupId: u, optionIds: [u] }] },
    ];
    expect(manualOrderSchema.safeParse({ ...base, lines: [], giveawayLines }).success).toBe(true);
    expect(manualOrderSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
  });
  it("requires a reason for price overrides", () => {
    const r = manualOrderSchema.safeParse({
      ...base,
      lines: [{ ...base.lines[0], unitPriceFils: 25000 }],
    });
    expect(r.success).toBe(false);
    expect(
      manualOrderSchema.safeParse({
        ...base,
        lines: [{ ...base.lines[0], unitPriceFils: 25000, overrideReason: "Friend discount" }],
      }).success,
    ).toBe(true);
  });
  it("requires an address and emirate for delivery", () => {
    expect(manualOrderSchema.safeParse({ ...base, fulfilment: "delivery" }).success).toBe(false);
    expect(
      manualOrderSchema.safeParse({
        ...base,
        fulfilment: "delivery",
        deliveryEmirate: "dubai",
        deliveryAddress: { line1: "Villa 1", area: "Jumeirah" },
      }).success,
    ).toBe(true);
  });
  it("requires an amount for partial payments", () => {
    expect(
      manualOrderSchema.safeParse({ ...base, payment: { mode: "partial", amountFils: 0 } }).success,
    ).toBe(false);
  });
  it("builds WhatsApp links", () => {
    const text = paymentLinkMessage({
      name: "Layla Ahmed",
      number: "SOL-001001",
      amount: "AED 280",
      url: "https://pay",
    });
    expect(text).toContain("Hello Layla,");
    expect(waLink("+971501234567", "hi there")).toBe("https://wa.me/971501234567?text=hi%20there");
  });
});
