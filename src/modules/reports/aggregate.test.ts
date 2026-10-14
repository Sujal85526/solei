import { describe, expect, it } from "vitest";
import {
  bestSellers,
  buildEventReport,
  clampDay,
  compareRow,
  formatBp,
  orderDay,
  orderMoney,
  ratioBp,
  reportDays,
  rowMarginBp,
} from "./aggregate";
import type { LineFact, OrderFact, PaymentFact, ReportFacts, StockFact } from "./types";

const CAT = { perfume: "cat-p", spray: "cat-s" };

function order(id: string, o: Partial<OrderFact> = {}): OrderFact {
  return {
    id,
    number: `SOL-${id}`,
    event_day: "2026-11-01",
    placed_at: "2026-11-01T08:00:00Z",
    status: "completed",
    channel: "pos",
    total_fils: 0,
    vat_fils: 0,
    discount_fils: 0,
    ...o,
  };
}

function line(orderId: string, l: Partial<LineFact> = {}): LineFact {
  return {
    order_id: orderId,
    variant_id: "v-capri",
    product_name: "Capri Perfume",
    variant_label: "50 ml",
    sku: "SOL-P-CAP-50",
    category_id: CAT.perfume,
    category_slug: "perfume",
    category_name: "Perfumes",
    destination_id: "d-capri",
    destination_name: "Capri",
    qty: 1,
    line_total_fils: 28000,
    is_reward: false,
    unit_cost_fils: 9000,
    ...l,
  };
}

const pay = (orderId: string, amount: number, p: Partial<PaymentFact> = {}): PaymentFact => ({
  order_id: orderId,
  kind: "payment",
  method: "cash",
  amount_fils: amount,
  ...p,
});

const stock = (s: Partial<StockFact> & Pick<StockFact, "day" | "type" | "qty">): StockFact => ({
  variant_id: "v-capri",
  product_name: "Capri Perfume",
  variant_label: "50 ml",
  sku: "SOL-P-CAP-50",
  sort: 1,
  ...s,
});

/** Three-day expo: 1–3 Nov 2026. */
function facts(over: Partial<ReportFacts> = {}): ReportFacts {
  return {
    event: {
      id: "e1",
      name: "Expo",
      type: "exhibition",
      status: "completed",
      start_date: "2026-11-01",
      end_date: "2026-11-03",
      location: "ADNEC",
      emirate: "abu_dhabi",
      closed_at: null,
      participation_fee_fils: 500000,
      fee_payment_status: "paid",
    },
    financial: true,
    orders: [
      // Day 1: two perfumes (VAT inclusive 5%: 56000 → VAT 2667)
      order("o1", { total_fils: 56000, vat_fils: 2667 }),
      // Day 2: a spray, paid by card
      order("o2", {
        event_day: "2026-11-02",
        placed_at: "2026-11-02T10:00:00Z",
        total_fils: 19000,
        vat_fils: 905,
      }),
      // Day 2: cancelled — must not count anywhere
      order("o3", {
        event_day: "2026-11-02",
        status: "cancelled",
        total_fils: 28000,
        vat_fils: 1333,
      }),
    ],
    lines: [
      line("o1", { qty: 2, line_total_fils: 56000 }),
      line("o2", {
        variant_id: "v-soho",
        product_name: "Soho All-over spray",
        variant_label: "100 ml",
        sku: "SOL-S-SOH-100",
        category_id: CAT.spray,
        category_slug: "all_over_spray",
        category_name: "All-over sprays",
        destination_id: "d-soho",
        destination_name: "Soho",
        line_total_fils: 19000,
        unit_cost_fils: 5500,
      }),
      line("o3"),
    ],
    payments: [
      pay("o1", 56000),
      pay("o2", 19000, { method: "card_terminal" }),
      pay("o3", 28000),
      pay("o3", 28000, { kind: "refund" }),
    ],
    stock: [],
    expenses: [
      { category: "setup", amount_fils: 100000, incurred_on: "2026-10-31", note: null },
      { category: "staff", amount_fils: 40000, incurred_on: "2026-11-01", note: null },
    ],
    ...over,
  };
}

describe("business days", () => {
  it("uses the POS event_day when present", () => {
    expect(orderDay({ event_day: "2026-11-02", placed_at: "2026-11-01T22:00:00Z" })).toBe(
      "2026-11-02",
    );
  });

  it("buckets placed_at in Asia/Dubai (UTC+4) when event_day is missing", () => {
    // 21:30 UTC on 1 Nov is 01:30 on 2 Nov in Dubai.
    expect(orderDay({ event_day: null, placed_at: "2026-11-01T21:30:00Z" })).toBe("2026-11-02");
    // 19:59 UTC is still 23:59 on 1 Nov in Dubai.
    expect(orderDay({ event_day: null, placed_at: "2026-11-01T19:59:00Z" })).toBe("2026-11-01");
  });

  it("lists every event day plus days with sales outside the range", () => {
    const f = facts();
    expect(reportDays(f)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    f.orders.push(order("late", { event_day: "2026-11-04", total_fils: 100 }));
    expect(reportDays(f)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
  });

  it("does not add a day for a cancelled order outside the range", () => {
    const f = facts();
    f.orders.push(order("x", { event_day: "2026-11-09", status: "cancelled" }));
    expect(reportDays(f)).not.toContain("2026-11-09");
  });

  it("clamps stock movements to the first and last day", () => {
    const days = ["2026-11-01", "2026-11-02"];
    expect(clampDay("2026-10-31", days)).toBe("2026-11-01");
    expect(clampDay("2026-11-02", days)).toBe("2026-11-02");
    expect(clampDay("2026-11-05", days)).toBe("2026-11-02");
  });
});

describe("totals", () => {
  it("excludes cancelled orders and unpaid website checkouts", () => {
    const f = facts();
    f.orders.push(order("w", { status: "pending_payment", channel: "website", total_fils: 9999 }));
    f.lines.push(line("w", { qty: 5 }));
    const { summary, byMethod } = buildEventReport(f);
    expect(summary.orders).toBe(2);
    expect(summary.units).toBe(3);
    expect(summary.revenueFils).toBe(75000);
    // The cancelled order's payment and refund are left out of the method breakdown.
    expect(byMethod).toEqual([
      { method: "cash", payments: 1, receivedFils: 56000, refundedFils: 0, netFils: 56000 },
      {
        method: "card_terminal",
        payments: 1,
        receivedFils: 19000,
        refundedFils: 0,
        netFils: 19000,
      },
    ]);
  });

  it("subtracts refunds from revenue and pro-rates the VAT", () => {
    const f = facts();
    f.payments.push(pay("o1", 5600, { kind: "refund" }));
    const [o1] = orderMoney(f);
    expect(o1.refundedFils).toBe(5600);
    expect(o1.revenueFils).toBe(50400);
    expect(o1.vatFils).toBe(2400); // 2667 × 50400 / 56000 = 2400.3
    const { summary, byMethod } = buildEventReport(f);
    expect(summary.grossSalesFils).toBe(75000);
    expect(summary.refundsFils).toBe(5600);
    expect(summary.revenueFils).toBe(69400);
    expect(byMethod.find((m) => m.method === "cash")).toMatchObject({
      receivedFils: 56000,
      refundedFils: 5600,
      netFils: 50400,
    });
  });

  it("never lets a refund take an order below zero", () => {
    const f = facts();
    f.payments.push(pay("o2", 25000, { kind: "refund" }));
    const o2 = orderMoney(f).find((m) => m.order.id === "o2")!;
    expect(o2.revenueFils).toBe(0);
    expect(o2.vatFils).toBe(0);
  });

  it("computes COGS from line cost snapshots, profit ex VAT and margins", () => {
    const { summary } = buildEventReport(facts());
    expect(summary.vatFils).toBe(2667 + 905);
    expect(summary.netRevenueFils).toBe(75000 - 3572);
    expect(summary.cogsFils).toBe(2 * 9000 + 5500);
    expect(summary.grossProfitFils).toBe(71428 - 23500);
    expect(summary.grossMarginBp).toBe(ratioBp(47928, 71428)); // 67.10%
    expect(summary.grossMarginBp).toBe(6710);
    expect(summary.expensesFils).toBe(140000);
    expect(summary.feeFils).toBe(500000);
    expect(summary.netProfitFils).toBe(47928 - 640000);
    expect(summary.netMarginBp).toBe(-82891); // −828.9%
  });

  it("counts lines without a cost snapshot as zero cost and reports them", () => {
    const f = facts();
    f.lines[1] = { ...f.lines[1], unit_cost_fils: null };
    const { summary } = buildEventReport(f);
    expect(summary.cogsFils).toBe(18000);
    expect(summary.linesWithoutCost).toBe(1);
  });

  it("treats a waived participation fee as zero", () => {
    const f = facts();
    f.event.fee_payment_status = "waived";
    expect(buildEventReport(f).summary.feeFils).toBe(0);
  });

  it("hides every financial figure without reports.financial.view", () => {
    const f = facts({ financial: false, expenses: [] });
    f.event.participation_fee_fils = null;
    f.lines = f.lines.map((l) => ({ ...l, unit_cost_fils: null }));
    const r = buildEventReport(f);
    expect(r.summary.revenueFils).toBe(75000);
    expect(r.summary.cogsFils).toBeNull();
    expect(r.summary.grossProfitFils).toBeNull();
    expect(r.summary.netProfitFils).toBeNull();
    expect(r.summary.linesWithoutCost).toBe(0);
    expect(r.byVariant.every((v) => v.cogsFils === null)).toBe(true);
    expect(r.byDay.every((d) => d.cogsFils === null && d.grossProfitFils === null)).toBe(true);
  });

  it("returns null margins when there is no revenue", () => {
    expect(ratioBp(0, 0)).toBeNull();
    const r = buildEventReport(facts({ orders: [], lines: [], payments: [] }));
    expect(r.summary.grossMarginBp).toBeNull();
    expect(r.summary.avgOrderFils).toBeNull();
  });

  it("formats basis points as a percentage", () => {
    expect(formatBp(6710)).toBe("67.1%");
    expect(formatBp(-8290)).toBe("-82.9%");
    expect(formatBp(null)).toBe("—");
  });
});

describe("per day", () => {
  it("filters orders, lines and payments to the chosen day", () => {
    const r = buildEventReport(facts(), "2026-11-02");
    expect(r.summary.orders).toBe(1);
    expect(r.summary.units).toBe(1);
    expect(r.summary.revenueFils).toBe(19000);
    expect(r.summary.cogsFils).toBe(5500);
    expect(r.byMethod.map((m) => m.method)).toEqual(["card_terminal"]);
    expect(r.byCategory.map((c) => c.label)).toEqual(["All-over sprays"]);
  });

  it("leaves event-level expenses and the fee out of a single day", () => {
    const { summary } = buildEventReport(facts(), "2026-11-01");
    expect(summary.grossProfitFils).not.toBeNull();
    expect(summary.expensesFils).toBeNull();
    expect(summary.feeFils).toBeNull();
    expect(summary.netProfitFils).toBeNull();
  });

  it("adds up to the total across days", () => {
    const r = buildEventReport(facts());
    expect(r.byDay.map((d) => d.revenueFils)).toEqual([56000, 19000, 0]);
    expect(r.byDay.reduce((s, d) => s + d.units, 0)).toBe(r.summary.units);
    expect(r.byDay.reduce((s, d) => s + (d.cogsFils ?? 0), 0)).toBe(r.summary.cogsFils);
  });
});

describe("breakdowns", () => {
  it("groups by variant, destination and category, best sellers by units", () => {
    const f = facts();
    f.orders.push(order("o4", { total_fils: 19000, vat_fils: 905 }));
    f.lines.push(
      line("o4", {
        variant_id: "v-soho",
        product_name: "Soho All-over spray",
        variant_label: "100 ml",
        sku: "SOL-S-SOH-100",
        destination_id: "d-soho",
        destination_name: "Soho",
        category_id: CAT.spray,
        category_name: "All-over sprays",
        line_total_fils: 19000,
        unit_cost_fils: 5500,
      }),
    );
    const r = buildEventReport(f);
    expect(r.byVariant.map((v) => [v.label, v.units, v.salesFils])).toEqual([
      ["Capri Perfume · 50 ml", 2, 56000],
      ["Soho All-over spray · 100 ml", 2, 38000],
    ]);
    expect(r.byDestination.map((d) => d.label)).toEqual(["Capri", "Soho"]);
    // Product margin is on the line value without its order's VAT share: 56000 − 2667 = 53333.
    expect(r.byVariant[0].netSalesFils).toBe(53333);
    expect(rowMarginBp(r.byVariant[0])).toBe(ratioBp(53333 - 18000, 53333));
    expect(r.byCategory.map((c) => [c.label, c.units, c.cogsFils])).toEqual([
      ["Perfumes", 2, 18000],
      ["All-over sprays", 2, 11000],
    ]);
    // Same units: the higher-selling variant ranks first.
    expect(bestSellers(r.byVariant).map((v) => v.sku)).toEqual(["SOL-P-CAP-50", "SOL-S-SOH-100"]);
  });
});

describe("stock", () => {
  const moves: StockFact[] = [
    stock({ day: "2026-10-31", type: "transfer_in", qty: 20 }), // allocated the evening before
    stock({ day: "2026-11-01", type: "sale", qty: -5 }),
    stock({ day: "2026-11-02", type: "sale", qty: -3 }),
    stock({ day: "2026-11-02", type: "refund_return", qty: 1 }),
    stock({ day: "2026-11-02", type: "damage", qty: -1 }),
    stock({ day: "2026-11-03", type: "transfer_out", qty: -12 }), // close-out
  ];

  it("shows allocated / sold / returned / damaged / remaining for the event", () => {
    const [row] = buildEventReport(facts({ stock: moves })).stock;
    expect(row).toMatchObject({
      allocated: 20,
      sold: 7,
      returned: 12,
      damaged: 1,
      other: 0,
      remaining: 0,
    });
  });

  it("shows a day's movements and the closing stock that evening", () => {
    const day1 = buildEventReport(facts({ stock: moves }), "2026-11-01").stock[0];
    expect(day1).toMatchObject({ allocated: 20, sold: 5, remaining: 15 });
    const day2 = buildEventReport(facts({ stock: moves }), "2026-11-02").stock[0];
    expect(day2).toMatchObject({ allocated: 0, sold: 2, damaged: 1, remaining: 12 });
  });
});

describe("compare", () => {
  it("normalises by scheduled days", () => {
    const row = compareRow(facts());
    expect(row.days).toBe(3);
    expect(row.revenueFils).toBe(75000);
    expect(row.revenuePerDayFils).toBe(25000);
    expect(row.unitsPerDay).toBe(1);
    expect(row.eventCostsFils).toBe(640000);
    expect(row.netProfitFils).toBe(47928 - 640000);
  });

  it("drops cost columns without the financial permission", () => {
    const f = facts({ financial: false, expenses: [] });
    f.event.participation_fee_fils = null;
    const row = compareRow(f);
    expect(row.cogsFils).toBeNull();
    expect(row.eventCostsFils).toBeNull();
    expect(row.netMarginBp).toBeNull();
  });
});
