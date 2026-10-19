import { describe, expect, it } from "vitest";
import { freeDeliveryProgress, priceCart, type PriceCartInput } from "./pricing";

const base: PriceCartInput = {
  lines: [],
  vatRateBp: 500,
  pricesIncludeVat: true,
  deliveryFeeFils: 2_000,
  freeDeliveryThresholdFils: 50_000,
  fulfilment: "delivery",
};

const perfume = { unitPriceFils: 28_000, qty: 1 };
const spray = { unitPriceFils: 19_000, qty: 1 };

describe("priceCart — VAT inclusive (launch default)", () => {
  it("two perfumes reach free delivery: AED 560 total with VAT contained", () => {
    const p = priceCart({ ...base, lines: [{ ...perfume, qty: 2 }] });
    expect(p.subtotalFils).toBe(56_000);
    expect(p.deliveryFeeFils).toBe(0);
    expect(p.freeDelivery).toBe(true);
    expect(p.amountToFreeDeliveryFils).toBeNull();
    expect(p.totalFils).toBe(56_000);
    // 56000 × 500 / 10500 = 2666.67 → 2667
    expect(p.vatFils).toBe(2_667);
    expect(p.vatIncluded).toBe(true);
    expect(p.itemCount).toBe(2);
  });

  it("charges the zone fee below the threshold and includes it in VAT", () => {
    const p = priceCart({ ...base, lines: [perfume] });
    expect(p.subtotalFils).toBe(28_000);
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.freeDelivery).toBe(false);
    expect(p.amountToFreeDeliveryFils).toBe(22_000);
    expect(p.totalFils).toBe(30_000);
    // 30000 × 500 / 10500 = 1428.57 → 1429
    expect(p.vatFils).toBe(1_429);
  });

  it("is free exactly at the threshold", () => {
    const p = priceCart({ ...base, freeDeliveryThresholdFils: 47_000, lines: [perfume, spray] });
    expect(p.subtotalFils).toBe(47_000);
    expect(p.deliveryFeeFils).toBe(0);
    expect(p.freeDelivery).toBe(true);
  });

  it("one fils below the threshold still pays delivery", () => {
    const p = priceCart({
      ...base,
      freeDeliveryThresholdFils: 47_001,
      lines: [perfume, spray],
    });
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.amountToFreeDeliveryFils).toBe(1);
  });

  it("computes per-line totals", () => {
    const p = priceCart({ ...base, lines: [{ ...perfume, qty: 3 }, spray] });
    expect(p.lines.map((l) => l.lineTotalFils)).toEqual([84_000, 19_000]);
    expect(p.subtotalFils).toBe(103_000);
  });
});

describe("priceCart — VAT exclusive", () => {
  it("adds VAT on goods and delivery", () => {
    const p = priceCart({ ...base, pricesIncludeVat: false, lines: [perfume] });
    expect(p.subtotalFils).toBe(28_000);
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.vatFils).toBe(1_500);
    expect(p.vatIncluded).toBe(false);
    expect(p.totalFils).toBe(31_500);
  });

  it("rounds VAT half-up", () => {
    // 1010 × 5% = 50.5 → 51
    const p = priceCart({
      ...base,
      pricesIncludeVat: false,
      deliveryFeeFils: 0,
      lines: [{ unitPriceFils: 1_010, qty: 1 }],
    });
    expect(p.vatFils).toBe(51);
    expect(p.totalFils).toBe(1_061);
  });

  it("handles a zero VAT rate", () => {
    const p = priceCart({ ...base, vatRateBp: 0, pricesIncludeVat: false, lines: [perfume] });
    expect(p.vatFils).toBe(0);
    expect(p.totalFils).toBe(30_000);
  });
});

describe("priceCart — delivery", () => {
  it("pickup never pays delivery and has no free-delivery nudge", () => {
    const p = priceCart({ ...base, fulfilment: "pickup", lines: [perfume] });
    expect(p.deliveryFeeFils).toBe(0);
    expect(p.freeDelivery).toBe(false);
    expect(p.amountToFreeDeliveryFils).toBeNull();
    expect(p.totalFils).toBe(28_000);
  });

  it("keeps delivery pending (null) until a zone is chosen", () => {
    const p = priceCart({ ...base, deliveryFeeFils: null, lines: [perfume] });
    expect(p.deliveryFeeFils).toBeNull();
    expect(p.totalFils).toBe(28_000);
    expect(p.amountToFreeDeliveryFils).toBe(22_000);
  });

  it("is free above the threshold even before a zone is chosen", () => {
    const p = priceCart({ ...base, deliveryFeeFils: null, lines: [{ ...perfume, qty: 2 }] });
    expect(p.deliveryFeeFils).toBe(0);
    expect(p.freeDelivery).toBe(true);
  });

  it("with no threshold delivery is always charged", () => {
    const p = priceCart({
      ...base,
      freeDeliveryThresholdFils: null,
      lines: [{ ...perfume, qty: 10 }],
    });
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.amountToFreeDeliveryFils).toBeNull();
  });

  it("an empty cart costs nothing", () => {
    const p = priceCart(base);
    expect(p).toMatchObject({
      subtotalFils: 0,
      deliveryFeeFils: 0,
      vatFils: 0,
      totalFils: 0,
      itemCount: 0,
      freeDelivery: false,
      amountToFreeDeliveryFils: null,
    });
  });
});

describe("priceCart — rewards", () => {
  it("reward lines are free and don't count towards free delivery", () => {
    const p = priceCart({
      ...base,
      lines: [perfume, { ...spray, isReward: true }],
    });
    expect(p.lines[1].lineTotalFils).toBe(0);
    expect(p.subtotalFils).toBe(28_000);
    expect(p.itemCount).toBe(2);
    expect(p.deliveryFeeFils).toBe(2_000);
  });

  it("a reward-only order still pays delivery (no threshold reached)", () => {
    const p = priceCart({ ...base, lines: [{ ...spray, isReward: true }] });
    expect(p.subtotalFils).toBe(0);
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.totalFils).toBe(2_000);
  });
});

describe("priceCart — coupon discount", () => {
  it("comes off the goods, not delivery, and VAT is on the discounted amount", () => {
    const p = priceCart({
      ...base,
      freeDeliveryThresholdFils: null,
      lines: [perfume],
      discountFils: 2_800,
    });
    expect(p.subtotalFils).toBe(28_000);
    expect(p.discountFils).toBe(2_800);
    expect(p.deliveryFeeFils).toBe(2_000);
    expect(p.totalFils).toBe(27_200);
    // (28000 − 2800 + 2000) × 500 / 10500 = 1295.24 → 1295
    expect(p.vatFils).toBe(1_295);
  });

  it("defaults to no discount", () => {
    expect(priceCart({ ...base, lines: [perfume] }).discountFils).toBe(0);
  });

  it("rejects a discount larger than the goods", () => {
    expect(() => priceCart({ ...base, lines: [spray], discountFils: 19_001 })).toThrow();
    expect(() => priceCart({ ...base, lines: [spray], discountFils: -1 })).toThrow();
  });
});

describe("priceCart — validation", () => {
  it.each([
    [{ ...base, lines: [{ unitPriceFils: 10.5, qty: 1 }] }, /integer fils/],
    [{ ...base, lines: [{ unitPriceFils: -1, qty: 1 }] }, /negative/],
    [{ ...base, lines: [{ unitPriceFils: 100, qty: 0 }] }, /Quantity/],
    [{ ...base, lines: [{ unitPriceFils: 100, qty: 1.5 }] }, /Quantity/],
    [{ ...base, vatRateBp: 5.5 }, /VAT rate/],
    [{ ...base, vatRateBp: -1 }, /VAT rate/],
    [{ ...base, deliveryFeeFils: -100 }, /negative/],
    [{ ...base, freeDeliveryThresholdFils: 0.5 }, /integer fils/],
  ])("rejects invalid input %#", (input, error) => {
    expect(() => priceCart(input as PriceCartInput)).toThrow(error);
  });

  it("returns only integers", () => {
    const p = priceCart({
      ...base,
      lines: [
        { unitPriceFils: 12_345, qty: 7 },
        { unitPriceFils: 999, qty: 3 },
      ],
    });
    for (const v of [p.subtotalFils, p.vatFils, p.totalFils, p.deliveryFeeFils ?? 0]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe("freeDeliveryProgress", () => {
  it("is a 0–1 ratio", () => {
    expect(freeDeliveryProgress(25_000, 50_000)).toBe(0.5);
    expect(freeDeliveryProgress(80_000, 50_000)).toBe(1);
    expect(freeDeliveryProgress(0, 50_000)).toBe(0);
  });
  it("is complete without a threshold", () => {
    expect(freeDeliveryProgress(100, null)).toBe(1);
    expect(freeDeliveryProgress(100, 0)).toBe(1);
  });
});
