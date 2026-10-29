import { describe, expect, it } from "vitest";
import { aedField, productSchema, slugify, variantSchema } from "./schema";

const uuid = "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";

describe("catalog schema", () => {
  it("slugifies names including accents", () => {
    expect(slugify("Côte d'Azur — Monaco")).toBe("cote-d-azur-monaco");
  });

  it("parses AED amounts into fils", () => {
    expect(aedField.parse("280")).toBe(28_000);
    expect(aedField.parse("1,250.5")).toBe(125_050);
    expect(aedField.safeParse("-1").success).toBe(false);
    expect(aedField.safeParse("abc").success).toBe(false);
  });

  it("parses product notes lists and checkboxes", () => {
    const p = productSchema.parse({
      name: "Capri Perfume",
      categoryId: uuid,
      notesTop: "Lemon, Bergamot,\nNeroli",
      active: "on",
    });
    expect(p.notesTop).toEqual(["Lemon", "Bergamot", "Neroli"]);
    expect(p.active).toBe(true);
    expect(p.featured).toBe(false);
    expect(p.destinationId).toBeUndefined();
    expect(
      productSchema.parse({ name: "X Perfume", categoryId: uuid, slug: "" }).slug,
    ).toBeUndefined();
    expect(
      productSchema.safeParse({ name: "X", categoryId: uuid, slug: "Bad Slug!" }).success,
    ).toBe(false);
  });

  it("validates variants", () => {
    const v = variantSchema.parse({
      productId: uuid,
      sku: "sol-p-cap-50",
      price: "280",
      cost: "",
      sizeMl: "50",
    });
    expect(v.sku).toBe("SOL-P-CAP-50");
    expect(v.price).toBe(28_000);
    expect(v.cost).toBeUndefined();
    expect(v.sizeMl).toBe(50);
    expect(variantSchema.safeParse({ productId: uuid, sku: "x", price: "1" }).success).toBe(false);
  });
});

describe("productSchema · early access", () => {
  const tier = "1d2b3c4d-5e6f-4a1b-8c55-9e1f8d6f0a2e";
  const base = { name: "Capri Perfume", categoryId: uuid };
  it("leaves early access alone when the form doesn't send it", () => {
    const p = productSchema.parse(base);
    expect(p.launchDate).toBeUndefined();
    expect(p.earlyAccessTierIds).toBeUndefined();
  });
  it("reads a launch day and tier ids", () => {
    const p = productSchema.parse({
      ...base,
      launchDate: "2026-11-15",
      earlyAccessTierIds: `${tier}, ${tier},${uuid}`,
    });
    expect(p.launchDate).toBe("2026-11-15");
    expect(p.earlyAccessTierIds).toEqual([tier, uuid]);
  });
  it("clears with empty values and refuses junk", () => {
    const p = productSchema.parse({ ...base, launchDate: "", earlyAccessTierIds: "" });
    expect(p.launchDate).toBeNull();
    expect(p.earlyAccessTierIds).toEqual([]);
    expect(productSchema.safeParse({ ...base, launchDate: "15/11/2026" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, earlyAccessTierIds: "gold" }).success).toBe(false);
  });
});
