/**
 * Format-neutral tables for exports. The Excel and CSV writers render these, so both stay in
 * step with the page and never include cost columns without reports.financial.view.
 */
import { eachBusinessDay, formatBusinessDate } from "@/lib/dates";
import { emirateLabels, eventTypeLabels, expenseCategoryLabels } from "@/modules/events/schema";
import { PAYMENT_METHOD_LABELS } from "@/modules/orders/status";
import {
  buildEventReport,
  compareRow,
  rowMarginBp,
  stockTotals,
  type CompareRow,
  type EventReport,
} from "./aggregate";
import type { ReportFacts } from "./types";

/** `aed` cells hold fils; `pct` cells hold basis points. Writers convert. */
export type CellFormat = "text" | "int" | "dec" | "aed" | "pct" | "date";
export type Cell = string | number | null;

export type Column = { header: string; format: CellFormat; width?: number };

export type Block =
  | { kind: "kv"; title?: string; rows: { label: string; value: Cell; format: CellFormat }[] }
  | { kind: "table"; title?: string; columns: Column[]; rows: Cell[][]; totals?: Cell[] };

export type Sheet = { name: string; blocks: Block[] };

export type WorkbookModel = { title: string; subtitle: string[]; sheets: Sheet[] };

const dayLabel = (d: string) =>
  formatBusinessDate(d, { weekday: "short", day: "numeric", month: "short" });

export function eventPlace(e: ReportFacts["event"]): string {
  return [e.location, e.emirate ? emirateLabels[e.emirate] : null].filter(Boolean).join(", ");
}

export function eventDates(e: ReportFacts["event"]): string {
  const days = eachBusinessDay(e.start_date, e.end_date).length;
  const start = formatBusinessDate(e.start_date);
  return days > 1
    ? `${start} – ${formatBusinessDate(e.end_date)} (${days} days)`
    : `${start} (1 day)`;
}

function summaryBlock(r: EventReport, title: string): Block {
  const s = r.summary;
  const rows: { label: string; value: Cell; format: CellFormat }[] = [
    { label: "Orders", value: s.orders, format: "int" },
    { label: "Units sold", value: s.units, format: "int" },
    { label: "Gross sales (incl. VAT)", value: s.grossSalesFils, format: "aed" },
    { label: "Refunds", value: s.refundsFils, format: "aed" },
    { label: "Revenue (incl. VAT)", value: s.revenueFils, format: "aed" },
    { label: "VAT", value: s.vatFils, format: "aed" },
    { label: "Net revenue (ex VAT)", value: s.netRevenueFils, format: "aed" },
    { label: "Average order", value: s.avgOrderFils, format: "aed" },
  ];
  if (r.financial) {
    rows.push(
      { label: "COGS", value: s.cogsFils, format: "aed" },
      { label: "Gross profit", value: s.grossProfitFils, format: "aed" },
      { label: "Gross margin", value: s.grossMarginBp, format: "pct" },
    );
    if (s.expensesFils !== null) {
      rows.push(
        { label: "Expenses", value: s.expensesFils, format: "aed" },
        { label: "Participation fee", value: s.feeFils, format: "aed" },
        { label: "Net profit", value: s.netProfitFils, format: "aed" },
        { label: "Net margin", value: s.netMarginBp, format: "pct" },
      );
    }
  }
  return { kind: "kv", title, rows };
}

function dayBlock(r: EventReport): Block {
  const fin = r.financial;
  return {
    kind: "table",
    title: "By day",
    columns: [
      { header: "Day", format: "date", width: 14 },
      { header: "Orders", format: "int" },
      { header: "Units", format: "int" },
      { header: "Revenue", format: "aed" },
      { header: "Net revenue (ex VAT)", format: "aed" },
      ...(fin
        ? ([
            { header: "COGS", format: "aed" },
            { header: "Gross profit", format: "aed" },
          ] as Column[])
        : []),
    ],
    rows: r.byDay.map((d) => [
      d.day,
      d.orders,
      d.units,
      d.revenueFils,
      d.netRevenueFils,
      ...(fin ? [d.cogsFils, d.grossProfitFils] : []),
    ]),
    totals: [
      "Total",
      r.summary.orders,
      r.summary.units,
      r.summary.revenueFils,
      r.summary.netRevenueFils,
      ...(fin ? [r.summary.cogsFils, r.summary.grossProfitFils] : []),
    ],
  };
}

function variantBlock(r: EventReport): Block {
  const fin = r.financial;
  return {
    kind: "table",
    title: "Units by product",
    columns: [
      { header: "SKU", format: "text", width: 16 },
      { header: "Product", format: "text", width: 26 },
      { header: "Size", format: "text", width: 10 },
      { header: "Category", format: "text", width: 16 },
      { header: "Destination", format: "text", width: 14 },
      { header: "Units", format: "int" },
      { header: "Sales", format: "aed" },
      ...(fin
        ? ([
            { header: "COGS", format: "aed" },
            { header: "Margin", format: "pct" },
          ] as Column[])
        : []),
    ],
    rows: r.byVariant.map((v) => [
      v.sku,
      v.productName,
      v.variantLabel,
      v.category,
      v.destination,
      v.units,
      v.salesFils,
      ...(fin ? [v.cogsFils, rowMarginBp(v)] : []),
    ]),
    totals: [
      "Total",
      "",
      "",
      "",
      "",
      r.byVariant.reduce((s, v) => s + v.units, 0),
      r.byVariant.reduce((s, v) => s + v.salesFils, 0),
      ...(fin ? [r.byVariant.reduce((s, v) => s + (v.cogsFils ?? 0), 0), null] : []),
    ],
  };
}

function groupBlock(title: string, label: string, rows: EventReport["byCategory"]): Block {
  return {
    kind: "table",
    title,
    columns: [
      { header: label, format: "text", width: 22 },
      { header: "Units", format: "int" },
      { header: "Sales", format: "aed" },
    ],
    rows: rows.map((g) => [g.label, g.units, g.salesFils]),
  };
}

function methodBlock(r: EventReport): Block {
  return {
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
      r.byMethod.reduce((s, m) => s + m.payments, 0),
      r.byMethod.reduce((s, m) => s + m.receivedFils, 0),
      r.byMethod.reduce((s, m) => s + m.refundedFils, 0),
      r.byMethod.reduce((s, m) => s + m.netFils, 0),
    ],
  };
}

function stockBlock(r: EventReport, scopeAll: boolean): Block {
  const t = stockTotals(r.stock);
  return {
    kind: "table",
    title: scopeAll ? "Stock" : "Stock (closing = on hand at the end of the day)",
    columns: [
      { header: "SKU", format: "text", width: 16 },
      { header: "Product", format: "text", width: 30 },
      { header: "Allocated", format: "int" },
      { header: "Sold", format: "int" },
      { header: "Returned to main", format: "int" },
      { header: "Damaged", format: "int" },
      { header: "Other", format: "int" },
      { header: scopeAll ? "Remaining" : "Closing", format: "int" },
    ],
    rows: r.stock.map((s) => [
      s.sku,
      s.label,
      s.allocated,
      s.sold,
      s.returned,
      s.damaged,
      s.other,
      s.remaining,
    ]),
    totals: ["Total", "", t.allocated, t.sold, t.returned, t.damaged, t.other, t.remaining],
  };
}

function expenseBlock(r: EventReport): Block {
  return {
    kind: "table",
    title: "Expenses",
    columns: [
      { header: "Category", format: "text", width: 18 },
      { header: "Entries", format: "int" },
      { header: "Amount", format: "aed" },
    ],
    rows: [
      ...r.expenses.map((e) => [expenseCategoryLabels[e.category], e.count, e.amountFils]),
      ["Participation fee", 1, r.summary.feeFils],
    ],
    totals: ["Total", "", (r.summary.expensesFils ?? 0) + (r.summary.feeFils ?? 0)],
  };
}

/** Excel-safe sheet name (≤ 31 chars, no []:*?/\). */
export function sheetName(name: string, taken: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, "-").slice(0, 31);
  let n = base;
  for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${base.slice(0, 27)} (${i})`;
  taken.add(n.toLowerCase());
  return n;
}

export function eventWorkbook(facts: ReportFacts): WorkbookModel {
  const all = buildEventReport(facts, "all");
  const taken = new Set<string>();
  const sheets: Sheet[] = [
    {
      name: sheetName("Summary", taken),
      blocks: [summaryBlock(all, "All days"), dayBlock(all)],
    },
    { name: sheetName("Products", taken), blocks: [variantBlock(all)] },
    {
      name: sheetName("Destinations & categories", taken),
      blocks: [
        groupBlock("By destination", "Destination", all.byDestination),
        groupBlock("By category", "Category", all.byCategory),
      ],
    },
    { name: sheetName("Payments", taken), blocks: [methodBlock(all)] },
    { name: sheetName("Stock", taken), blocks: [stockBlock(all, true)] },
  ];
  if (all.financial)
    sheets.push({ name: sheetName("Expenses", taken), blocks: [expenseBlock(all)] });

  all.days.forEach((day, i) => {
    const r = buildEventReport(facts, day);
    sheets.push({
      name: sheetName(
        `Day ${i + 1} · ${formatBusinessDate(day, { day: "numeric", month: "short" })}`,
        taken,
      ),
      blocks: [
        summaryBlock(r, dayLabel(day)),
        variantBlock(r),
        methodBlock(r),
        stockBlock(r, false),
      ],
    });
  });

  const e = facts.event;
  return {
    title: `Solei · Event report — ${e.name}`,
    subtitle: [
      [eventTypeLabels[e.type], eventDates(e), eventPlace(e)].filter(Boolean).join(" · "),
      all.financial
        ? "Revenue after refunds, incl. VAT. Profit and margins are ex VAT."
        : "Revenue after refunds, incl. VAT. Cost and profit figures need the financial reports permission.",
    ],
    sheets,
  };
}

/** Tidy one-table CSV: one row per day × variant (pivot-friendly). */
export function eventCsvTable(facts: ReportFacts): { columns: Column[]; rows: Cell[][] } {
  const all = buildEventReport(facts, "all");
  const fin = all.financial;
  const rows: Cell[][] = [];
  for (const day of all.days) {
    const r = buildEventReport(facts, day);
    for (const v of r.byVariant) {
      rows.push([
        day,
        v.sku,
        v.productName,
        v.variantLabel,
        v.category,
        v.destination,
        v.units,
        v.salesFils,
        ...(fin ? [v.cogsFils] : []),
      ]);
    }
  }
  return {
    columns: [
      { header: "Day", format: "date" },
      { header: "SKU", format: "text" },
      { header: "Product", format: "text" },
      { header: "Size", format: "text" },
      { header: "Category", format: "text" },
      { header: "Destination", format: "text" },
      { header: "Units", format: "int" },
      { header: "Sales (AED)", format: "aed" },
      ...(fin ? ([{ header: "COGS (AED)", format: "aed" }] as Column[]) : []),
    ],
    rows,
  };
}

export function compareTable(rows: CompareRow[], financial: boolean): Block & { kind: "table" } {
  return {
    kind: "table",
    columns: [
      { header: "Event", format: "text", width: 34 },
      { header: "Type", format: "text", width: 12 },
      { header: "Start", format: "date", width: 12 },
      { header: "End", format: "date", width: 12 },
      { header: "Days", format: "int" },
      { header: "Orders", format: "int" },
      { header: "Units", format: "int" },
      { header: "Revenue", format: "aed" },
      { header: "Revenue / day", format: "aed" },
      { header: "Units / day", format: "dec" },
      ...(financial
        ? ([
            { header: "COGS", format: "aed" },
            { header: "Expenses + fee", format: "aed" },
            { header: "Gross profit", format: "aed" },
            { header: "Net profit", format: "aed" },
            { header: "Gross margin", format: "pct" },
            { header: "Net margin", format: "pct" },
          ] as Column[])
        : []),
    ],
    rows: rows.map((r) => [
      r.name,
      eventTypeLabels[r.type],
      r.startDate,
      r.endDate,
      r.days,
      r.orders,
      r.units,
      r.revenueFils,
      r.revenuePerDayFils,
      r.unitsPerDay,
      ...(financial
        ? [
            r.cogsFils,
            r.eventCostsFils,
            r.grossProfitFils,
            r.netProfitFils,
            r.grossMarginBp,
            r.netMarginBp,
          ]
        : []),
    ]),
  };
}

export function compareWorkbook(all: ReportFacts[]): WorkbookModel {
  const financial = all.every((f) => f.financial);
  const rows = all.map(compareRow);
  return {
    title: "Solei · Event comparison",
    subtitle: [
      all.map((f) => f.event.name).join(" · "),
      "Revenue after refunds, incl. VAT; per-day figures use the scheduled event days. Profit and margins are ex VAT.",
    ],
    sheets: [{ name: "Comparison", blocks: [compareTable(rows, financial)] }],
  };
}

/** Plain values for CSV: AED as 0.00, percentages as 0.0, dates as YYYY-MM-DD. */
export function csvValue(value: Cell, format: CellFormat): string | number {
  if (value === null) return "";
  if (typeof value === "string") return value;
  if (format === "aed") return (value / 100).toFixed(2);
  if (format === "pct") return (value / 100).toFixed(1);
  return value;
}
