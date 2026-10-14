import { describe, expect, it } from "vitest";
import {
  cancelSchema,
  orderFiltersSchema,
  paymentSchema,
  refundSchema,
  searchNeedles,
} from "./schema";

const orderId = "7b0c6a52-3b0e-4b8e-9c43-1d2a3b4c5d6e";

describe("order forms", () => {
  it("parses a manual payment in AED to fils", () => {
    expect(
      paymentSchema.parse({ orderId, amount: "120.50", method: "cash", reference: " " }),
    ).toEqual({ orderId, amount: 12050, method: "cash", reference: undefined, note: undefined });
  });

  it("refuses zero amounts and online methods for manual payments", () => {
    expect(paymentSchema.safeParse({ orderId, amount: "0", method: "cash" }).success).toBe(false);
    expect(paymentSchema.safeParse({ orderId, amount: "10", method: "online_card" }).success).toBe(
      false,
    );
  });

  it("requires a refund reason", () => {
    expect(
      refundSchema.safeParse({ orderId, amount: "10", method: "cash", reason: "" }).success,
    ).toBe(false);
  });

  it("reads the restock checkbox", () => {
    expect(
      cancelSchema.parse({ orderId, reason: "Customer changed mind", restock: "on" }).restock,
    ).toBe(true);
    expect(cancelSchema.parse({ orderId, reason: "Damaged in transit" }).restock).toBe(false);
  });
});

describe("order list filters", () => {
  it("ignores invalid values instead of failing", () => {
    expect(
      orderFiltersSchema.parse({ channel: "fax", status: "all", from: "yesterday", page: "2" }),
    ).toEqual({ status: "all", page: 2 });
  });

  it("splits search into text and phone needles", () => {
    expect(searchNeedles("050 123 4567")).toEqual({ text: "050 123 4567", phone: "501234567" });
    expect(searchNeedles("+971 50 123")).toEqual({ text: "+971 50 123", phone: "50123" });
    expect(searchNeedles("Layla, (test)")).toEqual({ text: "Layla test", phone: null });
    expect(searchNeedles("SOL-001001")).toEqual({ text: "SOL-001001", phone: null });
    expect(searchNeedles("12")).toEqual({ text: "12", phone: null });
  });
});
