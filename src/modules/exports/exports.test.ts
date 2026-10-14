import { describe, expect, it } from "vitest";
import { parseRange } from "./params";
import { ordersTable, paymentsTable, stockTable, type OrderExportRow } from "./tables";

const sp = (q: string) => new URLSearchParams(q);

describe("export range", () => {
  it("defaults to this month in Dubai", () => {
    expect(parseRange(sp(""), "2026-10-14")).toEqual({ from: "2026-10-01", to: "2026-10-14" });
  });
  it("swaps reversed dates and ignores junk", () => {
    expect(parseRange(sp("from=2026-10-10&to=2026-10-02"), "2026-10-14")).toEqual({
      from: "2026-10-02",
      to: "2026-10-10",
    });
    expect(parseRange(sp("from=yesterday&to=2026-10-05"), "2026-10-14").from).toBe("2026-10-01");
  });
  it("caps the range at a year", () => {
    expect(parseRange(sp("from=2020-01-01&to=2026-10-14"), "2026-10-14").from).toBe("2025-10-14");
  });
});

const order = (o: Partial<OrderExportRow>): OrderExportRow => ({
  number: "SOL-001",
  placed_day: "2026-10-14",
  channel: "pos",
  status: "completed",
  event: null,
  event_day: null,
  customer: null,
  phone: null,
  email: null,
  emirate: null,
  fulfilment: "handed_over",
  units: 1,
  subtotal_fils: 26667,
  discount_fils: 0,
  delivery_fils: 0,
  vat_fils: 1333,
  total_fils: 28000,
  paid_fils: 28000,
  refunded_fils: 0,
  outstanding_fils: 0,
  payment_status: "paid",
  ...o,
});

describe("export tables", () => {
  it("labels orders and totals the money columns", () => {
    const t = ordersTable([order({}), order({ number: "SOL-002", units: 2, total_fils: 56000 })]);
    expect(t.rows[0]!.slice(0, 5)).toEqual([
      "SOL-001",
      "2026-10-14",
      "Event POS",
      "Completed",
      "Paid",
    ]);
    const total = t.columns.findIndex((c) => c.header === "Total");
    expect(t.totals![total]).toBe(84000);
    expect(t.totals![t.columns.findIndex((c) => c.header === "Units")]).toBe(3);
  });

  it("signs refunds negative and totals only succeeded payments", () => {
    const t = paymentsTable([
      {
        day: "2026-10-14",
        order_number: "SOL-1",
        channel: "pos",
        kind: "payment",
        method: "cash",
        status: "succeeded",
        amount_fils: 28000,
        reference: null,
        event: null,
      },
      {
        day: "2026-10-14",
        order_number: "SOL-1",
        channel: "pos",
        kind: "refund",
        method: "cash",
        status: "succeeded",
        amount_fils: 8000,
        reference: null,
        event: null,
      },
      {
        day: "2026-10-14",
        order_number: "SOL-2",
        channel: "website",
        kind: "payment",
        method: "online_card",
        status: "failed",
        amount_fils: 9900,
        reference: null,
        event: null,
      },
    ]);
    expect(t.rows[1]![6]).toBe(-8000);
    expect(t.totals![6]).toBe(20000);
  });

  it("flags low stock only outside event locations", () => {
    const t = stockTable([
      {
        sku: "A",
        product: "Capri",
        variant: "50 ml",
        location: "Warehouse",
        location_kind: "warehouse",
        on_hand: 3,
        threshold: 5,
      },
      {
        sku: "A",
        product: "Capri",
        variant: "50 ml",
        location: "Pop-up",
        location_kind: "event",
        on_hand: 1,
        threshold: 5,
      },
    ]);
    expect(t.rows.map((r) => r[7])).toEqual(["yes", ""]);
    expect(t.rows[1]![6]).toBeNull();
  });
});
