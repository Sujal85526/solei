import { describe, expect, it } from "vitest";
import {
  computeEstimate,
  estimateToQuoteLines,
  percentOf,
  quoteTotals,
  unpricedLines,
} from "./estimate";
import { fallbackBookingConfig } from "./fallback";

const config = fallbackBookingConfig();
const signature = config.packages.find((p) => p.name === "Signature")!;
const burgundy = config.flowers.find((f) => f.name === "Burgundy")!;
const blush = config.flowers.find((f) => f.name === "Blush pink")!;

describe("computeEstimate", () => {
  it("adds package, flowers (base + colour) and products at their from-price", () => {
    const e = computeEstimate(
      {
        packageId: signature.id,
        flowers: true,
        flowerOptionId: burgundy.id,
        productsInterest: [
          { category: "perfume", qty: 10 },
          { category: "all_over_spray", qty: 20 },
        ],
      },
      config,
    );
    expect(e.lines.map((l) => l.kind)).toEqual(["package", "flowers", "products", "products"]);
    expect(e.totalFils).toBe(650_000 + (80_000 + 15_000) + 10 * 28_000 + 20 * 19_000);
  });

  it("no flowers means no charge, even with a colour left in the draft", () => {
    const e = computeEstimate(
      { flowers: false, flowerOptionId: burgundy.id, productsInterest: [] },
      config,
    );
    expect(e).toEqual({ lines: [], totalFils: 0 });
  });

  it("a colour without surcharge costs the flower base price", () => {
    const e = computeEstimate(
      { flowers: true, flowerOptionId: blush.id, productsInterest: [] },
      config,
    );
    expect(e.totalFils).toBe(config.flowerBaseFils);
    expect(e.lines[0].label).toBe("Flowers — Blush pink");
  });

  it("lists unpriced categories without counting them, and skips zero quantities", () => {
    const e = computeEstimate(
      {
        flowers: false,
        productsInterest: [
          { category: "dukhoon", qty: 50 },
          { category: "perfume", qty: 0 },
          { category: "unknown", qty: 3 },
        ],
      },
      config,
    );
    expect(e.lines).toHaveLength(1);
    expect(e.totalFils).toBe(0);
    expect(unpricedLines(e).map((l) => l.category)).toEqual(["dukhoon"]);
  });

  it("ignores an unknown or deactivated package", () => {
    const e = computeEstimate({ packageId: "nope", flowers: false, productsInterest: [] }, config);
    expect(e.totalFils).toBe(0);
  });
});

describe("quoteTotals", () => {
  it("totals lines, subtracts the discount and defaults the deposit to the percentage", () => {
    const t = quoteTotals(
      [
        { label: "Signature booth", qty: 1, unitPriceFils: 650_000 },
        { label: "Giveaways", qty: 150, unitPriceFils: 2_500 },
      ],
      12_500,
      null,
      5000,
    );
    expect(t.subtotalFils).toBe(1_025_000);
    expect(t.totalFils).toBe(1_012_500);
    expect(t.depositFils).toBe(506_250);
    expect(t.lines[1].totalFils).toBe(375_000);
    expect(t.error).toBeUndefined();
  });

  it("rounds the default deposit half-up to whole fils", () => {
    expect(percentOf(101, 5000)).toBe(51);
    expect(percentOf(100_001, 3333)).toBe(33_330);
    expect(
      quoteTotals([{ label: "x", qty: 1, unitPriceFils: 333 }], 0, null, 2500).depositFils,
    ).toBe(83);
  });

  it("keeps an explicit deposit, including zero", () => {
    expect(quoteTotals([{ label: "x", qty: 2, unitPriceFils: 100 }], 0, 0, 5000).depositFils).toBe(
      0,
    );
    expect(
      quoteTotals([{ label: "x", qty: 2, unitPriceFils: 100 }], 0, 150, 5000).depositFils,
    ).toBe(150);
  });

  it("flags what the database would refuse", () => {
    expect(quoteTotals([], 0, null, 5000).error).toMatch(/at least one line/);
    expect(quoteTotals([{ label: " ", qty: 1, unitPriceFils: 1 }], 0, null, 5000).error).toMatch(
      /description/,
    );
    expect(
      quoteTotals([{ label: "x", qty: 1, unitPriceFils: 100 }], 101, null, 5000).error,
    ).toMatch(/discount/);
    expect(quoteTotals([{ label: "x", qty: 1, unitPriceFils: 100 }], 0, 101, 5000).error).toMatch(
      /deposit/,
    );
  });
});

describe("estimateToQuoteLines", () => {
  it("seeds the quote builder from the request, unpriced lines at 0", () => {
    const e = computeEstimate(
      {
        packageId: signature.id,
        flowers: false,
        productsInterest: [{ category: "dukhoon", qty: 40 }],
      },
      config,
    );
    expect(estimateToQuoteLines(e)).toEqual([
      { label: "Signature", qty: 1, unitPriceFils: 650_000 },
      { label: "Dukhoon (giveaways)", qty: 40, unitPriceFils: 0 },
    ]);
  });
});
