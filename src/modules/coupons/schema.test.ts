import { describe, expect, it } from "vitest";
import {
  couponFormSchema,
  couponScopeLabel,
  couponState,
  couponValueLabel,
  type Coupon,
} from "./schema";

const form = (over: Record<string, unknown>) =>
  couponFormSchema.safeParse({ code: "summer20", kind: "percent", value: "20", ...over });

describe("couponFormSchema", () => {
  it("normalises the code and turns a percentage into basis points", () => {
    const r = form({});
    expect(r.success && r.data.code).toBe("SUMMER20");
    expect(r.success && r.data.percentBp).toBe(2000);
    expect(r.success && r.data.amountFils).toBeNull();
  });

  it("turns an AED amount into fils", () => {
    const r = form({ kind: "fixed", value: "50" });
    expect(r.success && r.data.amountFils).toBe(5000);
  });

  it("needs no value for free delivery", () => {
    const r = form({ kind: "free_delivery", value: "" });
    expect(r.success).toBe(true);
    expect(r.success && [r.data.percentBp, r.data.amountFils]).toEqual([null, null]);
  });

  it("requires a value for % and AED codes", () => {
    expect(form({ value: "" }).success).toBe(false);
    expect(form({ kind: "fixed", value: "" }).success).toBe(false);
    expect(form({ value: "101" }).success).toBe(false);
  });

  it("parses the per-customer limit and scope", () => {
    const cat = "8f0a4f8c-6b1e-4c39-9a51-7b1b2b8e5c11";
    const r = form({ perCustomerLimit: "2", categoryIds: [cat] });
    expect(r.success && r.data.perCustomerLimit).toBe(2);
    expect(r.success && r.data.categoryIds).toEqual([cat]);
    expect(form({ perCustomerLimit: "0" }).success).toBe(false);
    expect(form({ perCustomerLimit: "" }).success && form({}).data?.perCustomerLimit).toBeNull();
  });

  it("refuses an end date before the start", () => {
    expect(form({ startsOn: "2026-11-02", endsOn: "2026-11-01" }).success).toBe(false);
  });
});

const coupon: Coupon = {
  id: "c",
  code: "X",
  description: null,
  kind: "percent",
  percentBp: 1000,
  amountFils: null,
  startsOn: null,
  endsOn: null,
  maxUses: 10,
  perCustomerLimit: null,
  minOrderFils: null,
  productIds: [],
  categoryIds: [],
  active: true,
  createdAt: "",
};

describe("labels and state", () => {
  it("describes the value", () => {
    expect(couponValueLabel(coupon)).toBe("10% off");
    expect(couponValueLabel({ ...coupon, kind: "free_delivery", percentBp: null })).toBe(
      "Free delivery",
    );
  });

  it("describes the scope", () => {
    const names = new Map([
      ["a", "Perfumes"],
      ["b", "Soho"],
    ]);
    expect(couponScopeLabel(coupon, names)).toBe("All products");
    expect(couponScopeLabel({ productIds: ["b"], categoryIds: ["a"] }, names)).toBe(
      "Perfumes, Soho",
    );
  });

  it("works out the state", () => {
    expect(couponState(coupon, 0, "2026-10-24")).toBe("active");
    expect(couponState(coupon, 10, "2026-10-24")).toBe("used_up");
    expect(couponState({ ...coupon, active: false }, 0)).toBe("paused");
    expect(couponState({ ...coupon, startsOn: "2026-11-01" }, 0, "2026-10-24")).toBe("scheduled");
    expect(couponState({ ...coupon, endsOn: "2026-10-01" }, 0, "2026-10-24")).toBe("expired");
  });
});
