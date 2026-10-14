import { describe, expect, it } from "vitest";
import { cartDetailsInputSchema, MAX_LINE_QTY, MAX_LINES } from "./schema";

const A = "8f14e45f-ceea-4e7a-9b1c-1a2b3c4d5e6f";

describe("cartDetailsInputSchema", () => {
  it("accepts lines with an optional emirate", () => {
    expect(cartDetailsInputSchema.parse({ lines: [{ variantId: A, qty: 2 }] })).toEqual({
      lines: [{ variantId: A, qty: 2 }],
    });
    expect(cartDetailsInputSchema.parse({ lines: [], emirate: "abu_dhabi" }).emirate).toBe(
      "abu_dhabi",
    );
    expect(cartDetailsInputSchema.parse({ lines: [], emirate: null }).emirate).toBeNull();
  });

  it.each([
    { lines: [{ variantId: "nope", qty: 1 }] },
    { lines: [{ variantId: A, qty: 0 }] },
    { lines: [{ variantId: A, qty: 1.5 }] },
    { lines: [{ variantId: A, qty: MAX_LINE_QTY + 1 }] },
    { lines: [], emirate: "atlantis" },
    { lines: Array.from({ length: MAX_LINES + 1 }, () => ({ variantId: A, qty: 1 })) },
    { lines: "x" },
    {},
  ])("rejects %j", (input) => {
    expect(cartDetailsInputSchema.safeParse(input).success).toBe(false);
  });
});
