import { describe, expect, it } from "vitest";
import {
  addLine,
  EMPTY_CART,
  itemCount,
  parseCart,
  qtyOf,
  reconcile,
  removeLine,
  serializeCart,
  setCoupons,
  setEmirate,
  setQty,
} from "./logic";
import { MAX_LINE_QTY, MAX_LINES } from "./schema";

const A = "8f14e45f-ceea-4e7a-9b1c-1a2b3c4d5e6f";
const B = "c9f0f895-fb98-4b9e-8c1a-2b3c4d5e6f70";

describe("cart logic", () => {
  it("adds lines and merges repeats", () => {
    let s = addLine(EMPTY_CART, A, 2);
    s = addLine(s, B);
    s = addLine(s, A, 1);
    expect(s.lines).toEqual([
      { variantId: A, qty: 3 },
      { variantId: B, qty: 1 },
    ]);
    expect(itemCount(s)).toBe(4);
    expect(qtyOf(s, A)).toBe(3);
    expect(qtyOf(s, "missing")).toBe(0);
  });

  it("never mutates the previous state", () => {
    const s = addLine(EMPTY_CART, A);
    addLine(s, A, 5);
    setQty(s, A, 9);
    expect(s.lines).toEqual([{ variantId: A, qty: 1 }]);
    expect(EMPTY_CART.lines).toEqual([]);
  });

  it("ignores non-positive adds", () => {
    expect(addLine(EMPTY_CART, A, 0)).toBe(EMPTY_CART);
    expect(addLine(EMPTY_CART, A, -2)).toBe(EMPTY_CART);
  });

  it("caps quantities at the sanity limit", () => {
    const s = addLine(EMPTY_CART, A, 500);
    expect(qtyOf(s, A)).toBe(MAX_LINE_QTY);
    expect(qtyOf(setQty(s, A, 1000), A)).toBe(MAX_LINE_QTY);
  });

  it("caps the number of lines", () => {
    let s = EMPTY_CART;
    for (let i = 0; i < MAX_LINES + 5; i++) {
      s = addLine(s, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    }
    expect(s.lines).toHaveLength(MAX_LINES);
  });

  it("setQty updates, and 0 removes", () => {
    let s = addLine(addLine(EMPTY_CART, A), B);
    s = setQty(s, A, 4);
    expect(qtyOf(s, A)).toBe(4);
    s = setQty(s, A, 0);
    expect(s.lines).toEqual([{ variantId: B, qty: 1 }]);
    expect(setQty(s, "unknown", 3)).toBe(s);
  });

  it("removes lines", () => {
    const s = addLine(addLine(EMPTY_CART, A), B);
    expect(removeLine(s, A).lines).toEqual([{ variantId: B, qty: 1 }]);
    expect(removeLine(s, "unknown")).toBe(s);
  });

  it("stores the emirate preference", () => {
    const s = setEmirate(EMPTY_CART, "dubai");
    expect(s.emirate).toBe("dubai");
    expect(setEmirate(s, "dubai")).toBe(s);
  });

  it("reconciles with server availability (clamp / remove / keep)", () => {
    const s = addLine(addLine(EMPTY_CART, A, 5), B, 2);
    const next = reconcile(
      s,
      new Map([
        [A, 3],
        [B, 0],
      ]),
    );
    expect(next.lines).toEqual([{ variantId: A, qty: 3 }]);
    // Nothing to change → same reference (no needless writes / renders).
    expect(reconcile(next, new Map([[A, 10]]))).toBe(next);
    expect(reconcile(next, new Map())).toBe(next);
  });
});

describe("cart persistence", () => {
  it("round-trips through JSON", () => {
    const s = setEmirate(addLine(addLine(EMPTY_CART, A, 2), B), "sharjah");
    expect(parseCart(serializeCart(s))).toEqual(s);
  });

  it.each([null, "", "not json", "42", "null", '"x"', "[]", '{"lines":"nope"}'])(
    "treats %j as an empty cart",
    (raw) => {
      expect(parseCart(raw)).toEqual(EMPTY_CART);
    },
  );

  it("drops invalid lines and unknown emirates, merges duplicates", () => {
    const raw = JSON.stringify({
      lines: [
        { variantId: A, qty: 1 },
        { variantId: "not-a-uuid", qty: 1 },
        { variantId: B, qty: 0 },
        { variantId: B, qty: 1.5 },
        { variantId: A, qty: 2 },
        { qty: 3 },
      ],
      emirate: "atlantis",
    });
    expect(parseCart(raw)).toEqual({ lines: [{ variantId: A, qty: 3 }], emirate: null });
  });
});

describe("discount codes kept with the bag", () => {
  it("normalises, de-duplicates and caps the codes, and survives a reload", () => {
    const s = setCoupons(EMPTY_CART, [" qa10 ", "QA10", "summer 20", "", "a", "b", "c", "d"]);
    expect(s.coupons).toEqual(["QA10", "SUMMER20", "A", "B", "C"]);
    expect(parseCart(serializeCart(s)).coupons).toEqual(["QA10", "SUMMER20", "A", "B", "C"]);
  });

  it("ignores junk in storage and leaves old bags without codes untouched", () => {
    expect(parseCart(JSON.stringify({ lines: [], coupons: [1, "ok", null] })).coupons).toEqual([
      "OK",
    ]);
    expect(parseCart(JSON.stringify({ lines: [], emirate: null })).coupons).toBeUndefined();
    expect(setCoupons(EMPTY_CART, [])).toBe(EMPTY_CART);
  });
});
