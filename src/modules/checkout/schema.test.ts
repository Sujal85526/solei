import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./schema";

const base = {
  clientUuid: "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f",
  firstName: "Layla",
  lastName: "Ahmed",
  phone: "050 123 4567",
  email: "Layla@Example.com",
  line1: "Villa 12, Street 4",
  area: "Al Bateen",
  city: "Abu Dhabi",
  emirate: "abu_dhabi",
  lines: [{ variantId: "9d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f", qty: 2 }],
};

describe("checkout schema", () => {
  it("normalises phone and email", () => {
    const r = checkoutSchema.parse(base);
    expect(r.phone).toBe("+971501234567");
    expect(r.email).toBe("layla@example.com");
    expect(r.marketingConsent).toBe(false);
  });

  it("requires the full address and a known emirate", () => {
    expect(checkoutSchema.safeParse({ ...base, area: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, emirate: "doha" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
  });
});
