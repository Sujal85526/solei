import { describe, expect, it } from "vitest";
import { bannerFormSchema, offerFormSchema, offerValueLabel, toDbSlots } from "./schema";

const P1 = "8f0a4f8c-6b1e-4c39-9a51-7b1b2b8e5c11";
const C1 = "1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e7f8";

const offer = (over: Record<string, unknown>) =>
  offerFormSchema.safeParse({
    name: "Ramadan sale",
    kind: "sale",
    valueType: "percent",
    value: "15",
    channels: ["website", "pos"],
    ...over,
  });

const slot = (over: Record<string, unknown> = {}) => ({
  label: "Perfume",
  productIds: [P1],
  categoryIds: [],
  qty: 1,
  ...over,
});

const bundle = (slots: unknown[], over: Record<string, unknown> = {}) =>
  offer({
    kind: "bundle",
    valueType: "price",
    value: "450",
    slots: JSON.stringify(slots),
    ...over,
  });

describe("offerFormSchema", () => {
  it("turns a sale percentage into basis points", () => {
    const r = offer({});
    expect(r.success && [r.data.percentBp, r.data.amountFils, r.data.bundlePriceFils]).toEqual([
      1500,
      null,
      null,
    ]);
  });

  it("turns AED off each item into fils", () => {
    const r = offer({ valueType: "amount", value: "30" });
    expect(r.success && [r.data.percentBp, r.data.amountFils]).toEqual([null, 3000]);
  });

  it("refuses a sale without a valid value", () => {
    expect(offer({ value: "" }).success).toBe(false);
    expect(offer({ value: "101" }).success).toBe(false);
    expect(offer({ valueType: "amount", value: "0" }).success).toBe(false);
  });

  it("needs a name and at least one place it applies", () => {
    expect(offer({ name: " " }).success).toBe(false);
    expect(offer({ channels: [] }).success).toBe(false);
  });

  it("prices a bundle of 2 to 6 items, each with products or categories", () => {
    const r = bundle([slot(), slot({ label: "Spray", productIds: [], categoryIds: [C1], qty: 2 })]);
    expect(r.success && r.data.bundlePriceFils).toBe(45000);
    expect(r.success && r.data.slots[1]).toEqual({
      label: "Spray",
      productIds: [],
      categoryIds: [C1],
      qty: 2,
    });
    expect(bundle([slot()]).success).toBe(false);
    expect(bundle(Array.from({ length: 7 }, () => slot())).success).toBe(false);
    expect(bundle([slot(), slot({ productIds: [] })]).success).toBe(false);
  });

  it("can take % off a bundle, and allows a bundle price of 0", () => {
    const pct = bundle([slot(), slot()], { valueType: "percent", value: "20" });
    expect(pct.success && [pct.data.percentBp, pct.data.bundlePriceFils]).toEqual([2000, null]);
    expect(bundle([slot(), slot()], { value: "0" }).success).toBe(true);
  });

  it("refuses bundle items that aren't valid JSON", () => {
    expect(offer({ kind: "bundle", valueType: "price", value: "450", slots: "{" }).success).toBe(
      false,
    );
  });

  it("makes buy X get Y free unless a percentage is given", () => {
    const free = offer({ kind: "buy_x_get_y", value: "", buyQty: "2", getQty: "1" });
    expect(free.success && [free.data.buyQty, free.data.getQty, free.data.percentBp]).toEqual([
      2, 1, 10000,
    ]);
    const half = offer({ kind: "buy_x_get_y", value: "50", buyQty: "1", getQty: "1" });
    expect(half.success && half.data.percentBp).toBe(5000);
    expect(offer({ kind: "buy_x_get_y", value: "", buyQty: "", getQty: "1" }).success).toBe(false);
    expect(offer({ kind: "buy_x_get_y", value: "", buyQty: "21", getQty: "1" }).success).toBe(
      false,
    );
  });

  it("refuses an end date before the start", () => {
    expect(offer({ startsOn: "2026-11-02", endsOn: "2026-11-01" }).success).toBe(false);
    expect(offer({ startsOn: "2026-11-01", endsOn: "2026-11-01" }).success).toBe(true);
  });

  it("stores bundle items in snake case", () => {
    expect(toDbSlots([{ label: "Perfume", productIds: [P1], categoryIds: [], qty: 1 }])).toEqual([
      { label: "Perfume", product_ids: [P1], category_ids: [], qty: 1 },
    ]);
  });

  it("labels each kind", () => {
    const base = {
      percentBp: null,
      amountFils: null,
      bundlePriceFils: null,
      buyQty: null,
      getQty: null,
    };
    expect(offerValueLabel({ ...base, kind: "sale", percentBp: 1500 })).toBe("15% off");
    expect(
      offerValueLabel({ ...base, kind: "buy_x_get_y", percentBp: 10000, buyQty: 2, getQty: 1 }),
    ).toBe("Buy 2 get 1 free");
  });
});

const banner = (over: Record<string, unknown>) =>
  bannerFormSchema.safeParse({
    placement: "announcement",
    body: "Free delivery this week",
    ...over,
  });

describe("bannerFormSchema", () => {
  it("accepts a message with no link", () => {
    const r = banner({ linkUrl: "", title: "" });
    expect(r.success && [r.data.linkUrl, r.data.title]).toEqual([null, null]);
  });

  it("needs a message", () => {
    expect(banner({ body: "  " }).success).toBe(false);
  });

  it("takes links to a page of the site or https only", () => {
    expect(banner({ linkUrl: "/shop" }).success).toBe(true);
    expect(banner({ linkUrl: "https://instagram.com/solei" }).success).toBe(true);
    expect(banner({ linkUrl: "http://example.com" }).success).toBe(false);
    expect(banner({ linkUrl: "shop" }).success).toBe(false);
    expect(banner({ linkUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("refuses an end date before the start", () => {
    expect(banner({ startsOn: "2026-11-02", endsOn: "2026-11-01" }).success).toBe(false);
  });

  it("refuses an unknown placement", () => {
    expect(banner({ placement: "footer" }).success).toBe(false);
  });
});
