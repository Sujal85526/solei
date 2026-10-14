import { describe, expect, it } from "vitest";
import { balanceSplit, cartTotal, posSaleSchema } from "./schema";

const u = "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";

describe("pos", () => {
  it("totals the cart", () => {
    expect(
      cartTotal([
        { priceFils: 28000, qty: 2 },
        { priceFils: 19000, qty: 1 },
      ]),
    ).toBe(75000);
  });
  it("balances split payments onto the last row", () => {
    expect(balanceSplit(56000, [20000])).toBe(36000);
    expect(balanceSplit(56000, [60000])).toBeNull();
  });
  it("validates a sale", () => {
    const sale = {
      clientUuid: u,
      eventId: u,
      soldAt: "2026-10-14T10:00:00+04:00",
      lines: [{ variantId: u, qty: 2 }],
      payments: [{ method: "cash", amountFils: 56000 }],
    };
    expect(posSaleSchema.safeParse(sale).success).toBe(true);
    expect(posSaleSchema.safeParse({ ...sale, payments: [] }).success).toBe(false);
    expect(
      posSaleSchema.safeParse({ ...sale, payments: [{ method: "online_card", amountFils: 1 }] })
        .success,
    ).toBe(false);
  });
});
