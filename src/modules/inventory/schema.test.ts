import { describe, expect, it } from "vitest";
import { adjustSchema, isLowStock, transferSchema } from "./schema";

const a = "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";
const b = "9d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";

describe("inventory schema", () => {
  it("turns damage and corrections into signed movements", () => {
    expect(
      adjustSchema.parse({
        variantId: a,
        locationId: b,
        kind: "damage",
        qty: "2",
        reason: "broken",
      }),
    ).toMatchObject({
      type: "damage",
      signedQty: -2,
    });
    expect(
      adjustSchema.parse({
        variantId: a,
        locationId: b,
        kind: "correction_add",
        qty: 3,
        reason: "stock count",
      }),
    ).toMatchObject({ type: "adjustment", signedQty: 3 });
  });

  it("requires a reason for adjustments", () => {
    expect(
      adjustSchema.safeParse({ variantId: a, locationId: b, kind: "damage", qty: 1, reason: "" })
        .success,
    ).toBe(false);
  });

  it("rejects fractional or zero quantities and same-location transfers", () => {
    expect(
      transferSchema.safeParse({ variantId: a, fromLocationId: a, toLocationId: b, qty: 1.5 })
        .success,
    ).toBe(false);
    expect(
      transferSchema.safeParse({ variantId: a, fromLocationId: a, toLocationId: b, qty: 0 })
        .success,
    ).toBe(false);
    expect(
      transferSchema.safeParse({ variantId: a, fromLocationId: b, toLocationId: b, qty: 1 })
        .success,
    ).toBe(false);
  });

  it("flags low stock with variant or default threshold", () => {
    expect(isLowStock(5, null, 5)).toBe(true);
    expect(isLowStock(6, null, 5)).toBe(false);
    expect(isLowStock(9, 10, 5)).toBe(true);
  });
});
