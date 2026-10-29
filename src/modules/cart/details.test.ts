import { describe, expect, it } from "vitest";
import { fallbackProducts } from "@/modules/storefront/fallback";
import type { CartSettings } from "@/modules/storefront/types";
import { resolveCart } from "./details";

const products = fallbackProducts();
const cannes = products.find((p) => p.slug === "cannes-perfume")!;
const soho = products.find((p) => p.slug === "soho-all-over-spray")!;
const P = cannes.variants[0].id;
const S = soho.variants[0].id;
const GONE = "deadbeef-0000-4000-8000-000000000000";

const settings: CartSettings = {
  vatRateBp: 500,
  pricesIncludeVat: true,
  freeDeliveryThresholdFils: 50_000,
  zones: [
    { emirate: "abu_dhabi", name: "Abu Dhabi", feeFils: 2_000 },
    { emirate: "dubai", name: "Dubai", feeFils: 2_500 },
  ],
};

describe("resolveCart", () => {
  it("prices available lines from the catalog (two perfumes = AED 560, free delivery)", () => {
    const d = resolveCart(
      { lines: [{ variantId: P, qty: 2 }], emirate: "dubai" },
      products,
      { [P]: 50 },
      settings,
    );
    expect(d.lines[0]).toMatchObject({
      status: "ok",
      qty: 2,
      unitPriceFils: 28_000,
      lineTotalFils: 56_000,
      product: { slug: "cannes-perfume", destinationName: "Cannes" },
    });
    expect(d.pricing.totalFils).toBe(56_000);
    expect(d.pricing.deliveryFeeFils).toBe(0);
    expect(d.zoneName).toBe("Dubai");
  });

  it("applies the chosen zone's fee below the threshold", () => {
    const d = resolveCart(
      { lines: [{ variantId: S, qty: 1 }], emirate: "abu_dhabi" },
      products,
      { [S]: 5 },
      settings,
    );
    expect(d.pricing.deliveryFeeFils).toBe(2_000);
    expect(d.pricing.totalFils).toBe(21_000);
    expect(d.pricing.amountToFreeDeliveryFils).toBe(31_000);
  });

  it("charges the Western Region's own AED 50 delivery fee", () => {
    const d = resolveCart(
      { lines: [{ variantId: S, qty: 1 }], emirate: "western_region" },
      products,
      { [S]: 5 },
      {
        ...settings,
        freeDeliveryThresholdFils: null,
        zones: [
          ...settings.zones,
          { emirate: "western_region", name: "Western Region", feeFils: 5_000 },
        ],
      },
    );
    expect(d.zoneName).toBe("Western Region");
    expect(d.pricing.deliveryFeeFils).toBe(5_000);
    expect(d.pricing.totalFils).toBe(24_000);
  });

  it("leaves delivery pending without an emirate or for an unknown zone", () => {
    for (const emirate of [null, "fujairah" as const]) {
      const d = resolveCart(
        { lines: [{ variantId: S, qty: 1 }], emirate },
        products,
        { [S]: 5 },
        settings,
      );
      expect(d.pricing.deliveryFeeFils).toBeNull();
      expect(d.emirate).toBeNull();
    }
  });

  it("clamps to availability, flags sold out and unknown variants, and excludes them from totals", () => {
    const d = resolveCart(
      {
        lines: [
          { variantId: P, qty: 5 },
          { variantId: S, qty: 1 },
          { variantId: GONE, qty: 1 },
        ],
      },
      products,
      { [P]: 3, [S]: 0 },
      settings,
    );
    expect(d.lines.map((l) => [l.status, l.qty, l.requestedQty])).toEqual([
      ["clamped", 3, 5],
      ["sold_out", 0, 1],
      ["unavailable", 0, 1],
    ]);
    expect(d.lines[2].product).toBeNull();
    expect(d.pricing.subtotalFils).toBe(84_000);
    expect(d.pricing.itemCount).toBe(3);
  });

  it("treats a variant missing from availability as sold out", () => {
    const d = resolveCart({ lines: [{ variantId: P, qty: 1 }] }, products, {}, settings);
    expect(d.lines[0].status).toBe("sold_out");
  });
});
