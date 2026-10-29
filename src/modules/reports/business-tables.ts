/**
 * The business report as a format-neutral workbook (Excel, PDF and CSV writers render it).
 * Cost, profit and inventory-value columns only appear with reports.financial.view.
 */
import { formatBusinessDate } from "@/lib/dates";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/modules/orders/status";
import { rowMarginBp } from "./aggregate";
import { notSelling, type BusinessReport } from "./business";
import type { Block, Cell, CellFormat, Column, Sheet, WorkbookModel } from "./tables";

const kv = (label: string, value: Cell, format: CellFormat) => ({ label, value, format });

export function rangeLabel(r: { from: string; to: string }): string {
  return r.from === r.to
    ? formatBusinessDate(r.from)
    : `${formatBusinessDate(r.from)} – ${formatBusinessDate(r.to)}`;
}

function overviewSheet(r: BusinessReport): Sheet {
  const s = r.summary;
  const p = r.prevHeadline;
  const blocks: Block[] = [
    {
      kind: "kv",
      title: "Sales",
      rows: [
        kv("Orders", s.orders, "int"),
        kv("Units sold", s.units, "int"),
        kv("Gross sales (incl. VAT)", s.grossSalesFils, "aed"),
        kv("Refunds", s.refundsFils, "aed"),
        kv("Revenue (incl. VAT)", s.revenueFils, "aed"),
        kv("VAT", s.vatFils, "aed"),
        kv("Net revenue (ex VAT)", s.netRevenueFils, "aed"),
        kv("Average order", s.avgOrderFils, "aed"),
      ],
    },
  ];
  if (p) {
    blocks.push({
      kind: "table",
      title: `Compared with ${rangeLabel(r.previous)}`,
      columns: [
        { header: "Figure", format: "text", width: 20 },
        { header: "This period", format: "aed" },
        { header: "Previous period", format: "aed" },
      ],
      rows: [
        ["Revenue", r.headline.revenueFils, p.revenueFils],
        ["Average order", r.headline.avgOrderFils, p.avgOrderFils],
        ...(r.financial
          ? [["Net profit", r.headline.netProfitFils, p.netProfitFils] as Cell[]]
          : []),
      ],
    });
    blocks.push({
      kind: "table",
      columns: [
        { header: "Count", format: "text", width: 20 },
        { header: "This period", format: "int" },
        { header: "Previous period", format: "int" },
      ],
      rows: [
        ["Orders", r.headline.orders, p.orders],
        ["Units", r.headline.units, p.units],
      ],
    });
  }
  blocks.push({
    kind: "table",
    title: `Sales by ${r.bucket}`,
    columns: [
      {
        header: r.bucket === "day" ? "Day" : r.bucket === "week" ? "Week of" : "Month",
        format: "date",
        width: 14,
      },
      { header: "Orders", format: "int" },
      { header: "Revenue", format: "aed" },
      { header: "Previous period", format: "aed" },
    ],
    rows: r.series.map((x) => [x.start, x.orders, x.revenueFils, x.prevRevenueFils]),
    totals: [
      "Total",
      r.series.reduce((t, x) => t + x.orders, 0),
      r.series.reduce((t, x) => t + x.revenueFils, 0),
      r.series.reduce((t, x) => t + x.prevRevenueFils, 0),
    ],
  });
  return { name: "Overview", blocks };
}

function pnlSheet(r: BusinessReport): Sheet | null {
  const p = r.pnl;
  if (!p) return null;
  const blocks: Block[] = [
    {
      kind: "kv",
      title: "Profit & loss (estimate)",
      rows: [
        kv("Revenue (incl. VAT, after refunds)", p.revenueFils, "aed"),
        kv("VAT", p.vatFils, "aed"),
        kv("Net revenue (ex VAT)", p.netRevenueFils, "aed"),
        kv("Product cost (COGS)", p.cogsFils, "aed"),
        kv("Gross profit", p.grossProfitFils, "aed"),
        kv("Gross margin", p.grossMarginBp, "pct"),
        kv("Event participation fees", p.eventFeesFils, "aed"),
        kv("Event expenses", p.eventExpensesFils, "aed"),
        kv("Business expenses", p.businessExpensesFils, "aed"),
        kv("Estimated net profit", p.netProfitFils, "aed"),
        kv("Net margin", p.netMarginBp, "pct"),
      ],
    },
    {
      kind: "table",
      title: "Business expenses",
      columns: [
        { header: "Category", format: "text", width: 22 },
        { header: "Entries", format: "int" },
        { header: "Amount", format: "aed" },
      ],
      rows: p.expenses.map((e) => [e.category, e.count, e.amountFils]),
      totals: ["Total", p.expenses.reduce((t, e) => t + e.count, 0), p.businessExpensesFils],
    },
    {
      kind: "table",
      title: "Event costs (fee + expenses)",
      columns: [
        { header: "Event", format: "text", width: 26 },
        { header: "Starts", format: "date", width: 14 },
        { header: "Costs", format: "aed" },
      ],
      rows: p.events.map((e) => [e.name, e.startDate, e.costsFils]),
      totals: ["Total", "", p.eventFeesFils + p.eventExpensesFils],
    },
  ];
  return { name: "Profit & loss", blocks };
}

function channelsSheet(r: BusinessReport): Sheet {
  return {
    name: "Channels & payments",
    blocks: [
      {
        kind: "table",
        title: "Revenue by channel",
        columns: [
          { header: "Channel", format: "text", width: 18 },
          { header: "Orders", format: "int" },
          { header: "Revenue", format: "aed" },
        ],
        rows: r.byChannel.map((c) => [CHANNEL_LABELS[c.channel], c.orders, c.revenueFils]),
        totals: [
          "Total",
          r.byChannel.reduce((t, c) => t + c.orders, 0),
          r.byChannel.reduce((t, c) => t + c.revenueFils, 0),
        ],
      },
      {
        kind: "table",
        title: "Payment methods",
        columns: [
          { header: "Method", format: "text", width: 18 },
          { header: "Payments", format: "int" },
          { header: "Received", format: "aed" },
          { header: "Refunded", format: "aed" },
          { header: "Net", format: "aed" },
        ],
        rows: r.byMethod.map((m) => [
          PAYMENT_METHOD_LABELS[m.method],
          m.payments,
          m.receivedFils,
          m.refundedFils,
          m.netFils,
        ]),
        totals: [
          "Total",
          r.byMethod.reduce((t, m) => t + m.payments, 0),
          r.byMethod.reduce((t, m) => t + m.receivedFils, 0),
          r.byMethod.reduce((t, m) => t + m.refundedFils, 0),
          r.byMethod.reduce((t, m) => t + m.netFils, 0),
        ],
      },
      {
        kind: "table",
        title: "Orders by status",
        columns: [
          { header: "Status", format: "text", width: 18 },
          { header: "Orders", format: "int" },
          { header: "Order value", format: "aed" },
        ],
        rows: r.orders.byStatus.map((s) => [ORDER_STATUS_LABELS[s.status], s.orders, s.totalFils]),
        totals: ["Total", r.orders.total, r.orders.byStatus.reduce((t, s) => t + s.totalFils, 0)],
      },
    ],
  };
}

function productsSheet(r: BusinessReport): Sheet {
  const fin = r.financial;
  const money: Column[] = fin
    ? [
        { header: "COGS", format: "aed" },
        { header: "Margin", format: "pct" },
      ]
    : [];
  return {
    name: "Products",
    blocks: [
      {
        kind: "table",
        title: "By category",
        columns: [
          { header: "Category", format: "text", width: 20 },
          { header: "Units", format: "int" },
          { header: "Sales", format: "aed" },
          ...money,
        ],
        rows: r.byCategory.map((c) => [
          c.label,
          c.units,
          c.salesFils,
          ...(fin ? [c.cogsFils, rowMarginBp(c)] : []),
        ]),
      },
      {
        kind: "table",
        title: "By product and size",
        columns: [
          { header: "SKU", format: "text", width: 16 },
          { header: "Product", format: "text", width: 26 },
          { header: "Size", format: "text", width: 10 },
          { header: "Category", format: "text", width: 16 },
          { header: "Units", format: "int" },
          { header: "Sales", format: "aed" },
          ...money,
        ],
        rows: r.byVariant.map((v) => [
          v.sku,
          v.productName,
          v.variantLabel,
          v.category,
          v.units,
          v.salesFils,
          ...(fin ? [v.cogsFils, rowMarginBp(v)] : []),
        ]),
        totals: [
          "Total",
          "",
          "",
          "",
          r.byVariant.reduce((t, v) => t + v.units, 0),
          r.byVariant.reduce((t, v) => t + v.salesFils, 0),
          ...(fin ? [r.byVariant.reduce((t, v) => t + (v.cogsFils ?? 0), 0), null] : []),
        ],
      },
    ],
  };
}

function stockSheet(r: BusinessReport, idleDays: number): Sheet {
  const fin = r.financial;
  const columns: Column[] = [
    { header: "SKU", format: "text", width: 16 },
    { header: "Product", format: "text", width: 30 },
    { header: "Category", format: "text", width: 16 },
    { header: "Sold", format: "int" },
    { header: "Per day", format: "dec" },
    { header: "On hand", format: "int" },
    { header: "Days of stock", format: "int" },
    { header: "Last sold", format: "date", width: 14 },
    ...(fin
      ? ([
          { header: "Unit cost", format: "aed" },
          { header: "Stock value", format: "aed" },
        ] as Column[])
      : []),
  ];
  const row = (m: BusinessReport["movers"][number]): Cell[] => [
    m.sku,
    m.label,
    m.category,
    m.unitsSold,
    m.perDay,
    m.onHand,
    m.daysLeft,
    m.lastSoldDay,
    ...(fin ? [m.unitCostFils, m.valueFils] : []),
  ];
  const idle = notSelling(r.movers, r.range, idleDays);
  return {
    name: "Stock",
    blocks: [
      {
        kind: "kv",
        title: "Inventory",
        rows: [
          kv("Units on hand (all locations)", r.inventory.units, "int"),
          ...(fin ? [kv("Inventory value at cost", r.inventory.valueFils, "aed")] : []),
        ],
      },
      { kind: "table", title: "Fast to slow movers", columns, rows: r.movers.map(row) },
      {
        kind: "table",
        title: `In stock, no sale in ${idleDays} days`,
        columns,
        rows: idle.map(row),
      },
    ],
  };
}

function customersSheet(r: BusinessReport): Sheet {
  const c = r.customers;
  return {
    name: "Customers",
    blocks: [
      {
        kind: "kv",
        title: "Customers",
        rows: [
          kv("Customers who bought", c.customers, "int"),
          kv("New (first order in this period)", c.newCustomers, "int"),
          kv("Returning", c.returning, "int"),
          kv("Repeat rate (ordered more than once)", c.repeatRateBp, "pct"),
          kv("Orders without a customer record", c.guestOrders, "int"),
        ],
      },
      {
        kind: "table",
        title: "Top spenders",
        columns: [
          { header: "Customer", format: "text", width: 24 },
          { header: "New / returning", format: "text", width: 14 },
          { header: "Orders", format: "int" },
          { header: "Spent", format: "aed" },
        ],
        rows: c.top.map((t) => [t.name, t.isNew ? "New" : "Returning", t.orders, t.revenueFils]),
      },
      {
        kind: "table",
        title: `New and returning by ${r.bucket}`,
        columns: [
          {
            header: r.bucket === "day" ? "Day" : r.bucket === "week" ? "Week of" : "Month",
            format: "date",
            width: 14,
          },
          { header: "New", format: "int" },
          { header: "Returning", format: "int" },
        ],
        rows: c.trend.map((t) => [t.start, t.newCustomers, t.returning]),
      },
    ],
  };
}

function monthsSheet(r: BusinessReport): Sheet {
  const { year, rows } = r.months;
  return {
    name: "Months",
    blocks: [
      {
        kind: "table",
        title: `${year} month by month, beside ${year - 1}`,
        columns: [
          { header: "Month", format: "text", width: 10 },
          { header: `Orders ${year}`, format: "int" },
          { header: `Revenue ${year}`, format: "aed" },
          { header: `Orders ${year - 1}`, format: "int" },
          { header: `Revenue ${year - 1}`, format: "aed" },
        ],
        rows: rows.map((m) => [m.label, m.orders, m.revenueFils, m.prevOrders, m.prevRevenueFils]),
        totals: [
          "Total",
          rows.reduce((t, m) => t + m.orders, 0),
          rows.reduce((t, m) => t + m.revenueFils, 0),
          rows.reduce((t, m) => t + m.prevOrders, 0),
          rows.reduce((t, m) => t + m.prevRevenueFils, 0),
        ],
      },
    ],
  };
}

export function businessWorkbook(r: BusinessReport, idleDays: number): WorkbookModel {
  return {
    title: "Solei — Business report",
    subtitle: [
      `${rangeLabel(r.range)} (${r.days} day${r.days === 1 ? "" : "s"})`,
      "Counted orders: all channels, not cancelled, not awaiting website payment. Refunds net off revenue.",
      ...(r.financial
        ? ["Profit is ex VAT and an estimate: product cost at sale, event and business expenses."]
        : []),
    ],
    sheets: [
      overviewSheet(r),
      pnlSheet(r),
      channelsSheet(r),
      productsSheet(r),
      customersSheet(r),
      stockSheet(r, idleDays),
      monthsSheet(r),
    ].filter((s): s is Sheet => s !== null),
  };
}

/** CSV is one table: the product/size table. */
export function businessCsvTable(r: BusinessReport) {
  const block = productsSheet(r).blocks[1] as Extract<Block, { kind: "table" }>;
  return { columns: block.columns, rows: block.rows };
}
