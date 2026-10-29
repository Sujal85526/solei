import { describe, expect, it } from "vitest";
import { addLine, EMPTY_CART, keyOf, setQty } from "@/modules/cart/logic";
import { resolveCart } from "@/modules/cart/details";
import type { CartSettings, StoreProduct } from "@/modules/storefront/types";
import {
  choiceGroups,
  giveawayFromFils,
  giveawayProblem,
  giveawaysFor,
  giveawayTypes,
  giveawayUnitPrice,
  itemsOfType,
  textGroups,
} from "./flow";
import type { GiveawayItem, StoreGiveaway } from "./types";

const V1 = "00000000-0000-4000-8000-000000000001";
const V2 = "00000000-0000-4000-8000-000000000002";
const V3 = "00000000-0000-4000-8000-000000000003";
const GW = "00000000-0000-4000-8000-0000000000aa";
const PACK = "00000000-0000-4000-8000-0000000000b1";
const GOLD = "00000000-0000-4000-8000-0000000000b2";
const TAG = "00000000-0000-4000-8000-0000000000b3";

const item = (variantId: string, type: "perfume" | "spray", priceFils: number): GiveawayItem => ({
  variantId,
  productSlug: `p-${variantId.slice(-1)}`,
  productName: `Scent ${variantId.slice(-1)}`,
  variantLabel: "50 ml",
  type:
    type === "perfume"
      ? { slug: "perfume", name: "Perfume" }
      : { slug: "spray", name: "All over spray" },
  priceFils,
  image: { url: "/x.jpg", alt: "" },
});

const giveaway: StoreGiveaway = {
  id: GW,
  slug: "wedding",
  name: "Wedding favours",
  description: "",
  images: [{ url: "/x.jpg", alt: "" }],
  minOrderQty: 20,
  optionGroups: [
    {
      id: PACK,
      name: "Packaging",
      kind: "single",
      required: true,
      maxLength: 40,
      options: [{ id: GOLD, label: "Gold box", priceDeltaFils: 1000, imageUrl: "/gold.jpg" }],
    },
    {
      id: TAG,
      name: "Names on the tag",
      kind: "text",
      required: false,
      maxLength: 30,
      options: [],
    },
  ],
  items: [item(V1, "perfume", 15000), item(V2, "spray", 9000), item(V3, "perfume", 16000)],
  occasions: [{ slug: "wedding", name: "Wedding" }],
};
const gold = [{ groupId: PACK, optionIds: [GOLD] }];

describe("giveaway flow", () => {
  it("lists the product types in order and the scents of a type", () => {
    expect(giveawayTypes(giveaway.items).map((t) => t.slug)).toEqual(["perfume", "spray"]);
    expect(itemsOfType(giveaway.items, "perfume").map((i) => i.variantId)).toEqual([V1, V3]);
    expect(itemsOfType(giveaway.items, null)).toHaveLength(3);
  });

  it("prices a piece from the bottle's giveaway price plus the choices", () => {
    expect(giveawayUnitPrice(giveaway, V1, gold)).toBe(16000);
    expect(giveawayUnitPrice(giveaway, V2, [])).toBe(9000);
    expect(giveawayUnitPrice(giveaway, "nope", gold)).toBeNull();
    expect(giveawayFromFils(giveaway)).toBe(9000);
  });

  it("asks for the scent, then the required choices, then the minimum", () => {
    expect(giveawayProblem(giveaway, null, gold, 20)).toBe("Please choose a scent.");
    expect(giveawayProblem(giveaway, V1, [], 20)).toBe("Please choose “Packaging”.");
    expect(giveawayProblem(giveaway, V1, gold, 19)).toBe("The minimum is 20 pieces.");
    expect(giveawayProblem(giveaway, V1, gold, 20)).toBeNull();
  });

  it("splits pick-from-a-list choices from written ones", () => {
    expect(choiceGroups(giveaway.optionGroups).map((g) => g.id)).toEqual([PACK]);
    expect(textGroups(giveaway.optionGroups).map((g) => g.id)).toEqual([TAG]);
  });

  it("filters giveaways by occasion", () => {
    expect(giveawaysFor([giveaway], "wedding")).toHaveLength(1);
    expect(giveawaysFor([giveaway], "eid")).toHaveLength(0);
    expect(giveawaysFor([giveaway], null)).toHaveLength(1);
  });
});

describe("giveaway lines in the bag", () => {
  it("keeps a giveaway line apart from the same bottle bought on its own, up to 1000 pieces", () => {
    let s = addLine(EMPTY_CART, V1, 1);
    s = addLine(s, V1, 150, gold, GW);
    expect(s.lines).toHaveLength(2);
    expect(keyOf(s.lines[1])).toContain(`@${GW}`);
    s = setQty(s, keyOf(s.lines[1]), 5000);
    expect(s.lines[1].qty).toBe(1000);
    s = setQty(s, keyOf(s.lines[0]), 500);
    expect(s.lines[0].qty).toBe(99);
  });

  it("prices a giveaway line from the giveaway (price, choices, minimum)", () => {
    const product: StoreProduct = {
      id: "p1",
      slug: "p-1",
      name: "Scent 1",
      description: "",
      notes: { top: [], heart: [], base: [] },
      featured: false,
      category: { slug: "perfume", name: "Perfume" },
      destination: null,
      images: [{ url: "/x.jpg", alt: "" }],
      variants: [{ id: V1, label: "50 ml", sizeMl: 50, sku: "S1", priceFils: 28000 }],
      optionGroups: [],
      minOrderQty: 1,
    };
    const settings: CartSettings = {
      vatRateBp: 0,
      pricesIncludeVat: true,
      freeDeliveryThresholdFils: null,
      zones: [],
    };
    const lines = [
      { variantId: V1, qty: 30, options: gold, giveawayId: GW },
      { variantId: V1, qty: 1 },
    ];
    const r = resolveCart({ lines }, [product], { [V1]: 100 }, settings, null, [giveaway]);
    expect(r.lines[0]).toMatchObject({
      unitPriceFils: 16000,
      minQty: 20,
      status: "ok",
      optionsText: "Wedding favours · Packaging: Gold box",
    });
    expect(r.lines[1].unitPriceFils).toBe(28000);
    // A giveaway that no longer offers the bottle (or is gone): the line can't be bought.
    const gone = resolveCart({ lines }, [product], { [V1]: 100 }, settings, null, []);
    expect(gone.lines[0].status).toBe("unavailable");
  });
});
