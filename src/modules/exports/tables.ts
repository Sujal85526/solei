/**
 * Export tables (format-neutral, rendered by the reports Excel/CSV writers). Rows come from
 * the `export_*` database functions, which check permissions; money is fils, dates are
 * Asia/Dubai YYYY-MM-DD.
 */
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { emirateLabels, sourceLabels, type Emirate } from "@/modules/customers/schema";
import type { CustomerSource } from "@/modules/customers/schema";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderChannel,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/modules/orders/status";
import type { Cell, Column, WorkbookModel } from "@/modules/reports/tables";
import { EXPORT_LABELS, type ExportKind } from "./params";

export type ExportTable = { columns: Column[]; rows: Cell[][]; totals?: Cell[] };

export type OrderExportRow = {
  number: string;
  placed_day: string;
  channel: OrderChannel;
  status: OrderStatus;
  event: string | null;
  event_day: string | null;
  customer: string | null;
  phone: string | null;
  email: string | null;
  emirate: Emirate | null;
  fulfilment: string;
  units: number;
  subtotal_fils: number;
  discount_fils: number;
  delivery_fils: number;
  vat_fils: number;
  total_fils: number;
  paid_fils: number;
  refunded_fils: number;
  outstanding_fils: number;
  payment_status: PaymentStatus;
};

export type PaymentExportRow = {
  day: string;
  order_number: string;
  channel: OrderChannel;
  kind: "payment" | "refund";
  method: PaymentMethod;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amount_fils: number;
  reference: string | null;
  event: string | null;
};

export type StockExportRow = {
  sku: string;
  product: string;
  variant: string;
  location: string;
  location_kind: "warehouse" | "event" | "other";
  on_hand: number;
  threshold: number;
};

export type CustomerExportRow = {
  name: string | null;
  phone: string | null;
  email: string | null;
  emirate: string | null;
  source: CustomerSource | null;
  order_count: number | null;
  total_spent_fils: number | null;
  first_purchase_at: string | null;
  last_purchase_at: string | null;
  marketing_consent: boolean | null;
  created_at: string | null;
};

const sum = (rows: Cell[][], i: number) =>
  rows.reduce((n, r) => n + (typeof r[i] === "number" ? (r[i] as number) : 0), 0);

/** Totals row: label in the first column, sums for the listed column indexes. */
function totalsFor(rows: Cell[][], width: number, cols: number[]): Cell[] {
  const t: Cell[] = Array.from({ length: width }, () => null);
  t[0] = "Total";
  for (const i of cols) t[i] = sum(rows, i);
  return t;
}

const FULFILMENT: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  handed_over: "Handed over",
};

export function ordersTable(data: OrderExportRow[]): ExportTable {
  const columns: Column[] = [
    { header: "Order", format: "text", width: 12 },
    { header: "Date", format: "date" },
    { header: "Channel", format: "text" },
    { header: "Status", format: "text" },
    { header: "Payment", format: "text" },
    { header: "Customer", format: "text", width: 22 },
    { header: "Phone", format: "text", width: 16 },
    { header: "Email", format: "text", width: 26 },
    { header: "Emirate", format: "text" },
    { header: "Fulfilment", format: "text" },
    { header: "Event", format: "text", width: 26 },
    { header: "Event day", format: "date" },
    { header: "Units", format: "int" },
    { header: "Subtotal", format: "aed" },
    { header: "Discount", format: "aed" },
    { header: "Delivery", format: "aed" },
    { header: "VAT", format: "aed" },
    { header: "Total", format: "aed" },
    { header: "Paid", format: "aed" },
    { header: "Refunded", format: "aed" },
    { header: "Outstanding", format: "aed" },
  ];
  const rows: Cell[][] = data.map((o) => [
    o.number,
    o.placed_day,
    CHANNEL_LABELS[o.channel],
    ORDER_STATUS_LABELS[o.status],
    PAYMENT_STATUS_LABELS[o.payment_status],
    o.customer,
    o.phone,
    o.email,
    o.emirate ? emirateLabels[o.emirate] : null,
    FULFILMENT[o.fulfilment] ?? o.fulfilment,
    o.event,
    o.event_day,
    o.units,
    o.subtotal_fils,
    o.discount_fils,
    o.delivery_fils,
    o.vat_fils,
    o.total_fils,
    o.paid_fils,
    o.refunded_fils,
    o.outstanding_fils,
  ]);
  return {
    columns,
    rows,
    totals: totalsFor(rows, columns.length, [12, 13, 14, 15, 16, 17, 18, 19, 20]),
  };
}

const PAYMENT_STATE: Record<PaymentExportRow["status"], string> = {
  pending: "Pending",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Refunds are negative so the Amount column sums to money actually kept. */
export function paymentsTable(data: PaymentExportRow[]): ExportTable {
  const columns: Column[] = [
    { header: "Date", format: "date" },
    { header: "Order", format: "text", width: 12 },
    { header: "Channel", format: "text" },
    { header: "Type", format: "text" },
    { header: "Method", format: "text" },
    { header: "Status", format: "text" },
    { header: "Amount", format: "aed" },
    { header: "Reference", format: "text", width: 22 },
    { header: "Event", format: "text", width: 26 },
  ];
  const rows: Cell[][] = data.map((p) => [
    p.day,
    p.order_number,
    CHANNEL_LABELS[p.channel],
    p.kind === "refund" ? "Refund" : "Payment",
    PAYMENT_METHOD_LABELS[p.method],
    PAYMENT_STATE[p.status],
    p.kind === "refund" ? -p.amount_fils : p.amount_fils,
    p.reference,
    p.event,
  ]);
  const ok = rows.filter((_, i) => data[i]!.status === "succeeded");
  const totals = totalsFor(ok, columns.length, [6]);
  totals[0] = "Total (succeeded)";
  return { columns, rows, totals };
}

const LOCATION_KIND: Record<StockExportRow["location_kind"], string> = {
  warehouse: "Warehouse",
  event: "Event",
  other: "Other",
};

export function stockTable(data: StockExportRow[]): ExportTable {
  const columns: Column[] = [
    { header: "SKU", format: "text", width: 16 },
    { header: "Product", format: "text", width: 24 },
    { header: "Variant", format: "text" },
    { header: "Location", format: "text", width: 26 },
    { header: "Location type", format: "text" },
    { header: "On hand", format: "int" },
    { header: "Alert level", format: "int" },
    { header: "Low", format: "text" },
  ];
  const rows: Cell[][] = data.map((s) => [
    s.sku,
    s.product,
    s.variant,
    s.location,
    LOCATION_KIND[s.location_kind],
    s.on_hand,
    s.location_kind === "event" ? null : s.threshold,
    s.location_kind !== "event" && s.on_hand <= s.threshold ? "yes" : "",
  ]);
  return { columns, rows, totals: totalsFor(rows, columns.length, [5]) };
}

const isoDay = (v: string | null) => (v ? businessDay(new Date(v)) : null);

/** Order stats only when the caller may see orders (same rule as the customers page). */
export function customersTable(data: CustomerExportRow[], withStats: boolean): ExportTable {
  const columns: Column[] = [
    { header: "Name", format: "text", width: 22 },
    { header: "Phone", format: "text", width: 16 },
    { header: "Email", format: "text", width: 26 },
    { header: "Emirate", format: "text" },
    { header: "Source", format: "text" },
    ...(withStats
      ? ([
          { header: "Orders", format: "int" },
          { header: "Total spent", format: "aed" },
          { header: "First purchase", format: "date" },
          { header: "Last purchase", format: "date" },
        ] satisfies Column[])
      : []),
    { header: "Marketing consent", format: "text" },
    { header: "Customer since", format: "date" },
  ];
  const rows: Cell[][] = data.map((c) => [
    c.name,
    c.phone,
    c.email,
    c.emirate ? (emirateLabels[c.emirate as Emirate] ?? c.emirate) : null,
    c.source ? sourceLabels[c.source] : null,
    ...(withStats
      ? [
          c.order_count ?? 0,
          c.total_spent_fils ?? 0,
          isoDay(c.first_purchase_at),
          isoDay(c.last_purchase_at),
        ]
      : []),
    c.marketing_consent ? "yes" : "no",
    isoDay(c.created_at),
  ]);
  return { columns, rows };
}

/** One-sheet workbook with the brand header. */
export function exportWorkbook(
  kind: ExportKind,
  table: ExportTable,
  range: { from: string; to: string } | null,
): WorkbookModel {
  const title = `Solei — ${EXPORT_LABELS[kind]}`;
  const subtitle = range
    ? [
        `${formatBusinessDate(range.from)} – ${formatBusinessDate(range.to)}`,
        `${table.rows.length} rows`,
      ]
    : [`As of ${formatBusinessDate(businessDay())}`, `${table.rows.length} rows`];
  return {
    title,
    subtitle,
    sheets: [{ name: EXPORT_LABELS[kind], blocks: [{ kind: "table", ...table }] }],
  };
}
