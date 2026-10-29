import { describe, expect, it } from "vitest";
import {
  buildBusinessReport,
  inventoryValue,
  monthRows,
  notSelling,
  type BizOrderFact,
  type BusinessFacts,
  type StockLevelFact,
} from "./business";
import type { LineFact } from "./types";

function order(id: string, o: Partial<BizOrderFact> = {}): BizOrderFact {
  return {
    id,
    day: "2026-10-05",
    status: "completed",
    channel: "website",
    total_fils: 10500,
    vat_fils: 500,
    discount_fils: 0,
    customer_id: null,
    event_id: null,
    ...o,
  };
}

function line(orderId: string, l: Partial<LineFact> = {}): LineFact {
  return {
    order_id: orderId,
    variant_id: "v-capri",
    product_name: "Capri Perfume",
    variant_label: "50 ml",
    sku: "CAP-50",
    category_id: "cat-p",
    category_slug: "perfume",
    category_name: "Perfumes",
    destination_id: null,
    destination_name: null,
    qty: 1,
    line_total_fils: 10500,
    is_reward: false,
    unit_cost_fils: 4000,
    ...l,
  };
}

function stock(id: string, s: Partial<StockLevelFact> = {}): StockLevelFact {
  return {
    variant_id: id,
    product_name: id,
    variant_label: "",
    sku: id,
    category_name: "Perfumes",
    active: true,
    on_hand: 10,
    cost_fils: 4000,
    last_sold_day: null,
    ...s,
  };
}

function facts(f: Partial<BusinessFacts> = {}): BusinessFacts {
  return {
    from: "2026-10-01",
    to: "2026-10-10",
    financial: true,
    orders: [],
    lines: [],
    payments: [],
    events: [],
    expenses: [],
    customers: [],
    months: [],
    stock: [],
    ...f,
  };
}

const sample = facts({
  orders: [
    order("o1", { customer_id: "c-old" }),
    order("o2", { customer_id: "c-new", channel: "pos", day: "2026-10-06" }),
    order("o3", { channel: "whatsapp", day: "2026-10-06" }),
    order("o4", { status: "cancelled" }),
    order("o5", { status: "pending_payment" }),
  ],
  lines: [
    line("o1"),
    line("o2", {
      variant_id: "v-spray",
      product_name: "Capri Spray",
      category_id: "cat-s",
      category_name: "Sprays",
      unit_cost_fils: 2000,
    }),
    line("o3"),
  ],
  payments: [
    { order_id: "o1", kind: "payment", method: "online_card", amount_fils: 10500 },
    { order_id: "o1", kind: "refund", method: "online_card", amount_fils: 2100 },
    { order_id: "o2", kind: "payment", method: "soft_pos", amount_fils: 10500 },
    { order_id: "o3", kind: "payment", method: "payment_link", amount_fils: 10500 },
  ],
  events: [
    { id: "e1", name: "Expo", start_date: "2026-10-06", fee_fils: 5000, expenses_fils: 1000 },
  ],
  expenses: [{ category: "Rent", amount_fils: 3000, count: 1 }],
  customers: [
    { id: "c-old", name: "Old", first_day: "2025-01-01", lifetime_orders: 4 },
    { id: "c-new", name: "New", first_day: "2026-10-06", lifetime_orders: 1 },
  ],
  stock: [
    stock("v-capri", { on_hand: 20, last_sold_day: "2026-10-06" }),
    stock("v-spray", { on_hand: 1, cost_fils: 2000, last_sold_day: "2026-10-06" }),
    stock("v-dukhoon", { on_hand: 5, cost_fils: 0, last_sold_day: "2026-06-01" }),
  ],
});

describe("business report", () => {
  const r = buildBusinessReport(
    sample,
    facts({ from: "2026-09-21", to: "2026-09-30", orders: [order("p1", { day: "2026-09-21" })] }),
  );

  it("counts revenue like the event report: refunds off, cancelled and unpaid out", () => {
    expect(r.summary.orders).toBe(3);
    expect(r.summary.revenueFils).toBe(31500 - 2100);
    expect(r.headline.avgOrderFils).toBe(Math.round(29400 / 3));
    expect(r.prevHeadline?.revenueFils).toBe(10500);
  });

  it("takes event costs and business expenses off for net profit", () => {
    const p = r.pnl!;
    expect(p.cogsFils).toBe(4000 + 2000 + 4000);
    expect(p.grossProfitFils).toBe(p.netRevenueFils - 10000);
    expect(p.netProfitFils).toBe(p.grossProfitFils - 5000 - 1000 - 3000);
    expect(r.headline.netProfitFils).toBe(p.netProfitFils);
  });

  it("hides profit without the financial permission", () => {
    const plain = buildBusinessReport(
      {
        ...sample,
        financial: false,
        lines: sample.lines.map((l) => ({ ...l, unit_cost_fils: null })),
      },
      null,
    );
    expect(plain.pnl).toBeNull();
    expect(plain.headline.netProfitFils).toBeNull();
    expect(plain.byCategory.every((c) => c.cogsFils === null)).toBe(true);
    expect(plain.inventory.valueFils).toBeNull();
  });

  it("splits by channel, payment method and category", () => {
    expect(r.byChannel.map((c) => c.channel).sort()).toEqual(["pos", "website", "whatsapp"]);
    expect(r.byChannel.find((c) => c.channel === "website")?.revenueFils).toBe(8400);
    expect(r.byMethod.find((m) => m.method === "online_card")?.netFils).toBe(8400);
    expect(r.byMethod.find((m) => m.method === "soft_pos")?.netFils).toBe(10500);
    expect(r.byCategory.map((c) => [c.label, c.units])).toEqual([
      ["Perfumes", 2],
      ["Sprays", 1],
    ]);
  });

  it("buckets the series by day with the previous period beside it", () => {
    expect(r.bucket).toBe("day");
    expect(r.series).toHaveLength(10);
    expect(r.series[4]).toMatchObject({ start: "2026-10-05", orders: 1, revenueFils: 8400 });
    expect(r.series[0].prevRevenueFils).toBe(10500);
  });

  it("reports orders by status", () => {
    expect(r.orders).toMatchObject({
      total: 5,
      counted: 3,
      completed: 3,
      cancelled: 1,
      pendingPayment: 1,
    });
  });

  it("tells new from returning customers", () => {
    expect(r.customers).toMatchObject({
      customers: 2,
      newCustomers: 1,
      returning: 1,
      guestOrders: 1,
    });
    expect(r.customers.repeatRateBp).toBe(5000);
    expect(r.customers.top[0]).toMatchObject({ id: "c-new", isNew: true });
    expect(r.customers.trend.find((t) => t.start === "2026-10-06")?.newCustomers).toBe(1);
  });

  it("ranks movers and finds what stopped selling", () => {
    expect(r.movers[0]).toMatchObject({
      variantId: "v-capri",
      unitsSold: 2,
      perDay: 0.2,
      daysLeft: 100,
    });
    expect(r.movers.find((m) => m.variantId === "v-dukhoon")).toMatchObject({
      unitsSold: 0,
      daysLeft: null,
      daysSinceSale: 131,
    });
    expect(notSelling(r.movers, r.range, 60).map((m) => m.variantId)).toEqual(["v-dukhoon"]);
  });
});

describe("inventory value and months", () => {
  it("values positive stock at unit cost", () => {
    expect(
      inventoryValue(
        [
          { on_hand: 3, cost_fils: 1000 },
          { on_hand: -2, cost_fils: 1000 },
          { on_hand: 4, cost_fils: 0 },
        ],
        true,
      ),
    ).toEqual({ units: 7, valueFils: 3000, variantsWithoutCost: 1 });
  });

  it("lays out Jan → Dec beside last year", () => {
    const rows = monthRows(
      [
        { month: "2026-03", orders: 2, revenue_fils: 500 },
        { month: "2025-03", orders: 1, revenue_fils: 200 },
      ],
      2026,
    );
    expect(rows).toHaveLength(12);
    expect(rows[2]).toMatchObject({
      month: "2026-03",
      revenueFils: 500,
      prevRevenueFils: 200,
      prevOrders: 1,
    });
  });
});

describe("business workbook", () => {
  it("renders every section to PDF, and drops profit without the financial permission", async () => {
    const { businessWorkbook } = await import("./business-tables");
    const { workbookToPdf } = await import("./pdf");
    const r = buildBusinessReport(sample, null);
    const model = businessWorkbook(r, 60);
    expect(model.sheets.map((s) => s.name)).toEqual([
      "Overview",
      "Profit & loss",
      "Channels & payments",
      "Products",
      "Customers",
      "Stock",
      "Months",
    ]);
    const pdf = await workbookToPdf(model);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");

    const plain = businessWorkbook(
      buildBusinessReport(
        {
          ...sample,
          financial: false,
          lines: sample.lines.map((l) => ({ ...l, unit_cost_fils: null })),
        },
        null,
      ),
      60,
    );
    expect(plain.sheets.map((s) => s.name)).not.toContain("Profit & loss");
    const headers = plain.sheets.flatMap((s) =>
      s.blocks.flatMap((b) =>
        b.kind === "table" ? b.columns.map((c) => c.header) : b.rows.map((x) => x.label),
      ),
    );
    expect(
      headers.some((h) => /COGS|cost|stock value|inventory value|profit|margin/i.test(h)),
    ).toBe(false);
  });
});
