import { describe, expect, it } from "vitest";
import { aedToFils, allocate, formatAED, vatFromInclusive, vatOnExclusive } from "./money";

describe("money", () => {
  it("converts AED to integer fils without float drift", () => {
    expect(aedToFils(280)).toBe(28_000);
    expect(aedToFils("190.10")).toBe(19_010);
    expect(aedToFils(0.1 + 0.2)).toBe(30);
    expect(aedToFils("1,250.50")).toBe(125_050);
    expect(() => aedToFils("abc")).toThrow();
  });

  it("formats AED", () => {
    expect(formatAED(28_000)).toBe("AED 280");
    expect(formatAED(1_250_050)).toBe("AED 12,500.50");
    expect(formatAED(1_250)).toBe("AED 12.50");
    expect(formatAED(28_000, { alwaysShowFils: true })).toBe("AED 280.00");
    expect(formatAED(-500)).toBe("-AED 5");
  });

  it("extracts VAT from inclusive prices at 5%", () => {
    // 280 incl. 5% → 13.33 VAT
    expect(vatFromInclusive(28_000, 500)).toBe(1_333);
    expect(vatFromInclusive(19_000, 500)).toBe(905);
    expect(vatFromInclusive(28_000, 0)).toBe(0);
    expect(vatFromInclusive(-28_000, 500)).toBe(-1_333);
  });

  it("adds VAT on exclusive prices", () => {
    expect(vatOnExclusive(28_000, 500)).toBe(1_400);
    expect(vatOnExclusive(1_999, 500)).toBe(100);
  });

  it("allocates without losing fils", () => {
    expect(allocate(1_000, 3)).toEqual([334, 333, 333]);
    expect(allocate(-1_000, 3)).toEqual([-334, -333, -333]);
    expect(allocate(1_000, 3).reduce((a, b) => a + b, 0)).toBe(1_000);
  });
});
