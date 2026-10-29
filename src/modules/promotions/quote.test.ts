import { describe, expect, it } from "vitest";
import type { CartDetails, CartDetailLine } from "@/modules/cart/details";
import type { CartSettings } from "@/modules/storefront/types";
import { tillDue, tillRewardValue, tillTotal } from "@/modules/pos/till";
import {
  applyQuote,
  bestSale,
  normaliseCodes,
  parseQuote,
  saleOff,
  toCartCoupon,
  type LiveSale,
} from "./quote";

const raw = {
  subtotal_fils: 44150,
  list_subtotal_fils: 47000,
  discount_fils: 9415,
  offer_discount_fils: 0,
  code_discount_fils: 9415,
  sale_fils: 2850,
  free_delivery: false,
  lines: [
    {
      variant_id: "p1",
      qty: 1,
      list_unit_fils: 28000,
      unit_price_fils: 28000,
      sale_offer_id: null,
      sale_name: null,
      discount_fils: 7800,
      reward_id: null,
      reward_points: null,
    },
    {
      variant_id: "s1",
      qty: 1,
      list_unit_fils: 19000,
      unit_price_fils: 16150,
      sale_offer_id: "o1",
      sale_name: "Sprays 15% off",
      discount_fils: 1615,
      reward_id: null,
      reward_points: null,
    },
  ],
  applied: [
    { type: "sale", offer_id: "o1", kind: "sale", name: "Sprays 15% off", discount_fils: 2850 },
    { type: "code", coupon_id: "c1", code: "TEN", kind: "percent", discount_fils: 4415 },
  ],
  codes: [
    {
      code: "TEN",
      ok: true,
      coupon_id: "c1",
      kind: "percent",
      discount_fils: 4415,
      eligible_fils: 44150,
      free_delivery: false,
    },
    { code: "SOLO", ok: false, reason: "not_combinable" },
  ],
};

describe("parseQuote", () => {
  it("types the database's answer", () => {
    const q = parseQuote(raw);
    expect(q.subtotalFils).toBe(44150);
    expect(q.discountFils).toBe(9415);
    expect(q.lines[1]).toMatchObject({
      unitPriceFils: 16150,
      listUnitFils: 19000,
      saleName: "Sprays 15% off",
    });
    expect(q.applied.map((a) => a.type)).toEqual(["sale", "code"]);
    expect(q.codes[1]).toEqual({
      code: "SOLO",
      ok: false,
      reason: "not_combinable",
      minOrderFils: null,
      minItems: null,
    });
  });

  it("survives an empty answer", () => {
    expect(parseQuote(null)).toMatchObject({ subtotalFils: 0, lines: [], applied: [], codes: [] });
  });
});

describe("toCartCoupon", () => {
  it("applied code keeps its discount, a refused one gets customer wording", () => {
    const q = parseQuote(raw);
    expect(toCartCoupon(q.codes[0])).toEqual({
      code: "TEN",
      discountFils: 4415,
      freeDelivery: false,
    });
    expect(toCartCoupon(q.codes[1])).toEqual({
      code: "SOLO",
      error: "This code can't be combined with your other code.",
    });
  });
});

describe("normaliseCodes", () => {
  it("trims, upper-cases, drops blanks and repeats, caps the count", () => {
    expect(normaliseCodes([" ten ", "TEN", "", null, "solo 10"])).toEqual(["TEN", "SOLO10"]);
    expect(normaliseCodes(["A1", "B2", "C3"], 2)).toEqual(["A1", "B2"]);
  });
});

const line = (variantId: string, unitPriceFils: number, qty = 1): CartDetailLine => ({
  key: variantId,
  variantId,
  optionsText: "",
  minQty: 1,
  requestedQty: qty,
  qty,
  available: 10,
  status: "ok",
  product: null,
  variantLabel: "",
  hasVariants: false,
  unitPriceFils,
  lineTotalFils: unitPriceFils * qty,
});
const settings: CartSettings = {
  vatRateBp: 500,
  pricesIncludeVat: true,
  freeDeliveryThresholdFils: 50000,
  zones: [{ emirate: "abu_dhabi", name: "Abu Dhabi", feeFils: 2500 }],
};
const details = (lines: CartDetailLine[]): CartDetails =>
  ({
    lines,
    pricing: {} as CartDetails["pricing"],
    coupon: null,
    emirate: "abu_dhabi",
    zoneName: "Abu Dhabi",
    settings,
  }) as CartDetails;

describe("applyQuote", () => {
  it("puts sale prices and discounts on the bought lines and prices the bag again", () => {
    const d = applyQuote(
      details([line("p1", 28000), line("x", 9000, 0), line("s1", 19000)]),
      parseQuote(raw),
      settings,
    );
    expect(d.lines[2]).toMatchObject({
      unitPriceFils: 16150,
      lineTotalFils: 16150,
      discountFils: 1615,
    });
    expect(d.lines[1].unitPriceFils).toBe(9000); // sold-out line untouched
    expect(d.pricing.subtotalFils).toBe(44150);
    expect(d.pricing.discountFils).toBe(9415);
    // Below the AED 500 threshold at sale prices: delivery charged.
    expect(d.pricing.deliveryFeeFils).toBe(2500);
    expect(d.pricing.totalFils).toBe(44150 - 9415 + 2500);
    expect(d.coupons).toHaveLength(2);
    expect(d.coupon).toEqual({ code: "TEN", discountFils: 4415, freeDelivery: false });
  });

  it("a free-delivery code waives the fee", () => {
    const q = parseQuote({ ...raw, discount_fils: 0, free_delivery: true, codes: [] });
    const d = applyQuote(details([line("p1", 28000), line("s1", 19000)]), q, settings);
    expect(d.pricing.deliveryFeeFils).toBe(0);
    expect(d.pricing.deliveryDiscountFils).toBe(2500);
  });
});

describe("sale prices (shop cards)", () => {
  const pct: LiveSale = {
    id: "a",
    name: "15%",
    percentBp: 1500,
    amountFils: null,
    productIds: null,
    startsAt: null,
    endsAt: null,
  };
  const aed: LiveSale = {
    id: "b",
    name: "AED 30",
    percentBp: null,
    amountFils: 3000,
    productIds: ["soho"],
    startsAt: null,
    endsAt: null,
  };

  it("rounds a percentage half-up to the fils, never below zero", () => {
    expect(saleOff({ percentBp: 3333, amountFils: null }, 19000)).toBe(6333);
    expect(saleOff({ percentBp: null, amountFils: 50000 }, 19000)).toBe(19000);
  });

  it("the best sale for the product wins, like the database", () => {
    expect(bestSale("soho", 19000, [pct, aed])).toEqual({ sale: aed, priceFils: 16000 });
    expect(bestSale("other", 19000, [pct, aed])).toEqual({ sale: pct, priceFils: 16150 });
  });

  it("ignores sales outside their dates", () => {
    const now = new Date("2026-11-01T10:00:00Z");
    const later = { ...pct, startsAt: "2026-11-02T00:00:00Z" };
    const ended = { ...aed, endsAt: "2026-11-01T00:00:00Z" };
    expect(bestSale("soho", 19000, [later, ended], now)).toBeNull();
  });
});

describe("till", () => {
  const q = parseQuote({
    subtotal_fils: 47000,
    discount_fils: 5600,
    lines: [
      { variant_id: "p1", qty: 1, unit_price_fils: 28000, discount_fils: 5600 },
      {
        variant_id: "s2",
        qty: 1,
        unit_price_fils: 19000,
        discount_fils: 0,
        reward_id: "r1",
        reward_points: 500,
      },
    ],
  });
  it("payments cover the total less rewards and points", () => {
    expect(tillTotal(q)).toBe(41400);
    expect(tillRewardValue(q)).toBe(19000);
    expect(tillDue(q, 1000)).toBe(21400);
    expect(tillDue(q, 999_999)).toBe(0);
  });
});
