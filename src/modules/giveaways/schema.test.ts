import { describe, expect, it } from "vitest";
import { giveawaySettingsSchema, occasionSchema } from "./schema";

const P = "00000000-0000-4000-8000-000000000001";
const V = "00000000-0000-4000-8000-000000000002";

describe("giveaway admin forms", () => {
  it("reads giveaway prices in AED, empty = the bottle's own price", () => {
    const r = giveawaySettingsSchema.parse({
      productId: P,
      isGiveaway: true,
      occasionIds: [],
      items: [{ variantId: V, price: "25.50" }],
    });
    expect(r.items[0]).toEqual({ variantId: V, price: 2550, active: true });
    const own = giveawaySettingsSchema.parse({
      productId: P,
      isGiveaway: true,
      occasionIds: [],
      items: [{ variantId: V, price: "" }],
    });
    expect(own.items[0].price).toBeNull();
  });

  it("refuses the same bottle twice and negative prices", () => {
    const twice = giveawaySettingsSchema.safeParse({
      productId: P,
      isGiveaway: true,
      occasionIds: [],
      items: [{ variantId: V }, { variantId: V }],
    });
    expect(twice.success).toBe(false);
    const negative = giveawaySettingsSchema.safeParse({
      productId: P,
      isGiveaway: true,
      occasionIds: [],
      items: [{ variantId: V, price: "-1" }],
    });
    expect(negative.success).toBe(false);
  });

  it("takes an occasion with an uploaded photo or a site image", () => {
    const r = occasionSchema.parse({
      name: "Wedding",
      blurb: "",
      imageUrl: "/images/products/perfumes-florals.jpg",
      storagePath: "",
      active: "on",
      sort: "10",
    });
    expect(r).toMatchObject({ blurb: null, storagePath: null, active: true, sort: 10 });
    expect(occasionSchema.safeParse({ name: "Eid", imageUrl: "javascript:x" }).success).toBe(false);
    expect(occasionSchema.safeParse({ name: "Eid", storagePath: "../x" }).success).toBe(false);
  });
});
