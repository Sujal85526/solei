/**
 * Event report roll-ups. Pure functions over the facts returned by `event_report_data()`, so
 * the same rules drive the page, the charts, the comparison and the Excel/CSV exports:
 *
 * - Counted orders: everything except `cancelled` and unpaid website checkouts (`pending_payment`).
 * - Business day: the POS-stamped `event_day`, else the Asia/Dubai date of `placed_at`.
 * - Revenue = order totals − succeeded refunds (VAT-inclusive, what the customer paid).
 *   Refunds count on the day of the order they belong to.
 * - Profit is computed ex VAT: net revenue = revenue − the VAT share of it (order VAT pro-rated
 *   by what was kept after refunds). COGS = Σ qty × cost snapshot of the line.
 * - Expenses and the participation fee are event-level: they count once, in "All days".
 *   A waived fee counts as zero.
 * - Product/destination/category "sales" are line totals (before order-level discounts and
 *   refunds), so they can differ slightly from revenue.
 */
import { businessDay, eachBusinessDay } from "@/lib/dates";
import type {
  ExpenseCategory,
  LineFact,
  OrderFact,
  OrderStatus,
  PaymentMethod,
  ReportFacts,
  ReportScope,
} from "./types";

export const EXCLUDED_STATUSES: readonly OrderStatus[] = ["cancelled", "pending_payment"];

export const isCounted = (o: Pick<OrderFact, "status">) => !EXCLUDED_STATUSES.includes(o.status);

/** Business day of an order (Asia/Dubai). */
export function orderDay(o: Pick<OrderFact, "event_day" | "placed_at">): string {
  return o.event_day ?? businessDay(new Date(o.placed_at));
}

/** Ratio as basis points (2534 = 25.34%), half away from zero; null when the base is 0. */
export function ratioBp(part: number, whole: number): number | null {
  if (!whole) return null;
  const v = (part * 10_000) / whole;
  return Math.sign(v) * Math.round(Math.abs(v));
}

/** Integer division rounded half-up, for non-negative pro-rating. */
function prorate(amount: number, part: number, whole: number): number {
  if (!whole) return 0;
  return Math.floor((amount * part * 2 + whole) / (whole * 2));
}

/** Every event day (start → end) plus any day that has sales outside it, sorted. */
export function reportDays(facts: Pick<ReportFacts, "event" | "orders">): string[] {
  const days = new Set(eachBusinessDay(facts.event.start_date, facts.event.end_date));
  for (const o of facts.orders) if (isCounted(o)) days.add(orderDay(o));
  return [...days].sort();
}

/** Stock moved before the first day (allocation) or after the last (close-out) lands on the edge day. */
export function clampDay(day: string, days: string[]): string {
  if (!days.length) return day;
  if (day < days[0]) return days[0];
  if (day > days[days.length - 1]) return days[days.length - 1];
  return day;
}

export type OrderMoney = {
  order: OrderFact;
  day: string;
  refundedFils: number;
  /** total − refunds, never below 0 */
  revenueFils: number;
  vatFils: number;
};

/** Counted orders with their refunds applied. */
export function orderMoney(facts: Pick<ReportFacts, "orders" | "payments">): OrderMoney[] {
  const refunds = new Map<string, number>();
  for (const p of facts.payments) {
    if (p.kind === "refund")
      refunds.set(p.order_id, (refunds.get(p.order_id) ?? 0) + p.amount_fils);
  }
  return facts.orders.filter(isCounted).map((order) => {
    const refundedFils = Math.min(refunds.get(order.id) ?? 0, order.total_fils);
    const revenueFils = order.total_fils - refundedFils;
    return {
      order,
      day: orderDay(order),
      refundedFils,
      revenueFils,
      vatFils: prorate(order.vat_fils, revenueFils, order.total_fils),
    };
  });
}

export type Summary = {
  orders: number;
  units: number;
  grossSalesFils: number;
  refundsFils: number;
  /** VAT-inclusive, after refunds */
  revenueFils: number;
  vatFils: number;
  /** revenue ex VAT — the base for profit and margin */
  netRevenueFils: number;
  avgOrderFils: number | null;
  /** Financial figures: null without reports.financial.view. */
  cogsFils: number | null;
  linesWithoutCost: number;
  grossProfitFils: number | null;
  grossMarginBp: number | null;
  /** Event-level costs: only in "all". */
  expensesFils: number | null;
  feeFils: number | null;
  netProfitFils: number | null;
  netMarginBp: number | null;
};

export type SalesRow = {
  key: string;
  label: string;
  detail?: string;
  units: number;
  salesFils: number;
  /** salesFils without the VAT share of the order it was sold in (base for product margin) */
  netSalesFils: number;
  cogsFils: number | null;
};

export type VariantRow = SalesRow & {
  sku: string;
  productName: string;
  variantLabel: string;
  category: string;
  destination: string;
};

export type MethodRow = {
  method: PaymentMethod;
  payments: number;
  receivedFils: number;
  refundedFils: number;
  netFils: number;
};

export type DayRow = {
  day: string;
  orders: number;
  units: number;
  revenueFils: number;
  netRevenueFils: number;
  cogsFils: number | null;
  grossProfitFils: number | null;
};

export type StockRow = {
  variantId: string;
  label: string;
  sku: string;
  sort: number;
  allocated: number;
  sold: number;
  returned: number;
  damaged: number;
  other: number;
  /** on hand at the end of the scope (closing stock for a day) */
  remaining: number;
};

export type ExpenseRow = { category: ExpenseCategory; amountFils: number; count: number };

export type EventReport = {
  scope: ReportScope;
  days: string[];
  financial: boolean;
  summary: Summary;
  byDay: DayRow[];
  byVariant: VariantRow[];
  byProduct: SalesRow[];
  byDestination: SalesRow[];
  byCategory: SalesRow[];
  bestSellers: VariantRow[];
  byMethod: MethodRow[];
  stock: StockRow[];
  expenses: ExpenseRow[];
};

const lineCost = (l: LineFact) => l.qty * (l.unit_cost_fils ?? 0);

/** Order → share of its total that is not VAT, to take VAT out of line values. */
export type NetRatio = Map<string, { total: number; vat: number }>;
const netOf = (l: LineFact, ratios: NetRatio) => {
  const r = ratios.get(l.order_id);
  return r ? prorate(l.line_total_fils, r.total - r.vat, r.total) : l.line_total_fils;
};

/** Gross margin of a product row: (sales ex VAT − COGS) / sales ex VAT. */
export const rowMarginBp = (r: Pick<SalesRow, "netSalesFils" | "cogsFils">) =>
  r.cogsFils === null ? null : ratioBp(r.netSalesFils - r.cogsFils, r.netSalesFils);

export function groupSales(
  lines: LineFact[],
  keyOf: (l: LineFact) => string,
  labelOf: (l: LineFact) => string,
  financial: boolean,
  ratios: NetRatio,
): SalesRow[] {
  const rows = new Map<string, SalesRow>();
  for (const l of lines) {
    const key = keyOf(l);
    const row = rows.get(key) ?? {
      key,
      label: labelOf(l),
      units: 0,
      salesFils: 0,
      netSalesFils: 0,
      cogsFils: financial ? 0 : null,
    };
    row.units += l.qty;
    row.salesFils += l.line_total_fils;
    row.netSalesFils += netOf(l, ratios);
    if (row.cogsFils !== null) row.cogsFils += lineCost(l);
    rows.set(key, row);
  }
  return [...rows.values()].sort(bySales);
}

const bySales = (a: SalesRow, b: SalesRow) =>
  b.salesFils - a.salesFils || b.units - a.units || a.label.localeCompare(b.label);

const NO_CATEGORY = "Uncategorised";
const NO_DESTINATION = "No destination";

export function variantRows(
  lines: LineFact[],
  financial: boolean,
  ratios: NetRatio = new Map(),
): VariantRow[] {
  const rows = new Map<string, VariantRow>();
  for (const l of lines) {
    const row = rows.get(l.variant_id) ?? {
      key: l.variant_id,
      label: l.variant_label ? `${l.product_name} · ${l.variant_label}` : l.product_name,
      sku: l.sku,
      productName: l.product_name,
      variantLabel: l.variant_label,
      category: l.category_name ?? NO_CATEGORY,
      destination: l.destination_name ?? NO_DESTINATION,
      units: 0,
      salesFils: 0,
      netSalesFils: 0,
      cogsFils: financial ? 0 : null,
    };
    row.units += l.qty;
    row.salesFils += l.line_total_fils;
    row.netSalesFils += netOf(l, ratios);
    if (row.cogsFils !== null) row.cogsFils += lineCost(l);
    rows.set(l.variant_id, row);
  }
  return [...rows.values()].sort(bySales);
}

/** Top sellers by units (ties: higher sales first). */
export function bestSellers(rows: VariantRow[], limit = 5): VariantRow[] {
  return [...rows]
    .sort(
      (a, b) => b.units - a.units || b.salesFils - a.salesFils || a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}

export function feeFils(facts: Pick<ReportFacts, "event" | "financial">): number | null {
  if (!facts.financial) return null;
  if (facts.event.fee_payment_status === "waived") return 0;
  return facts.event.participation_fee_fils ?? 0;
}

export function summarise(
  money: OrderMoney[],
  lines: LineFact[],
  opts: { financial: boolean; expensesFils: number | null; feeFils: number | null },
): Summary {
  const grossSalesFils = money.reduce((s, m) => s + m.order.total_fils, 0);
  const refundsFils = money.reduce((s, m) => s + m.refundedFils, 0);
  const revenueFils = grossSalesFils - refundsFils;
  const vatFils = money.reduce((s, m) => s + m.vatFils, 0);
  const netRevenueFils = revenueFils - vatFils;
  const cogsFils = opts.financial ? lines.reduce((s, l) => s + lineCost(l), 0) : null;
  const grossProfitFils = cogsFils === null ? null : netRevenueFils - cogsFils;
  const eventCosts =
    opts.expensesFils === null || opts.feeFils === null ? null : opts.expensesFils + opts.feeFils;
  const netProfitFils =
    grossProfitFils === null || eventCosts === null ? null : grossProfitFils - eventCosts;
  return {
    orders: money.length,
    units: lines.reduce((s, l) => s + l.qty, 0),
    grossSalesFils,
    refundsFils,
    revenueFils,
    vatFils,
    netRevenueFils,
    avgOrderFils: money.length ? Math.round(revenueFils / money.length) : null,
    cogsFils,
    linesWithoutCost: opts.financial ? lines.filter((l) => l.unit_cost_fils === null).length : 0,
    grossProfitFils,
    grossMarginBp: grossProfitFils === null ? null : ratioBp(grossProfitFils, netRevenueFils),
    expensesFils: opts.expensesFils,
    feeFils: opts.feeFils,
    netProfitFils,
    netMarginBp: netProfitFils === null ? null : ratioBp(netProfitFils, netRevenueFils),
  };
}

export function stockRows(facts: Pick<ReportFacts, "stock">, days: string[], scope: ReportScope) {
  const rows = new Map<string, StockRow>();
  for (const s of facts.stock) {
    const day = clampDay(s.day, days);
    const inScope = scope === "all" || day === scope;
    const upToScope = scope === "all" || day <= scope;
    if (!upToScope) continue;
    const row = rows.get(s.variant_id) ?? {
      variantId: s.variant_id,
      label: s.variant_label ? `${s.product_name} · ${s.variant_label}` : s.product_name,
      sku: s.sku,
      sort: s.sort,
      allocated: 0,
      sold: 0,
      returned: 0,
      damaged: 0,
      other: 0,
      remaining: 0,
    };
    row.remaining += s.qty;
    if (inScope) {
      switch (s.type) {
        case "transfer_in":
          row.allocated += s.qty;
          break;
        case "sale":
        case "refund_return":
          row.sold -= s.qty;
          break;
        case "transfer_out":
          row.returned -= s.qty;
          break;
        case "damage":
          row.damaged -= s.qty;
          break;
        default:
          row.other += s.qty;
      }
    }
    rows.set(s.variant_id, row);
  }
  return [...rows.values()]
    .filter((r) => r.allocated || r.sold || r.returned || r.damaged || r.other || r.remaining)
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
}

export function stockTotals(rows: StockRow[]) {
  return rows.reduce(
    (t, r) => ({
      allocated: t.allocated + r.allocated,
      sold: t.sold + r.sold,
      returned: t.returned + r.returned,
      damaged: t.damaged + r.damaged,
      other: t.other + r.other,
      remaining: t.remaining + r.remaining,
    }),
    { allocated: 0, sold: 0, returned: 0, damaged: 0, other: 0, remaining: 0 },
  );
}

export function methodRows(
  facts: Pick<ReportFacts, "payments">,
  orderIds: Set<string>,
): MethodRow[] {
  const rows = new Map<PaymentMethod, MethodRow>();
  for (const p of facts.payments) {
    if (!orderIds.has(p.order_id)) continue;
    const row = rows.get(p.method) ?? {
      method: p.method,
      payments: 0,
      receivedFils: 0,
      refundedFils: 0,
      netFils: 0,
    };
    if (p.kind === "payment") {
      row.payments += 1;
      row.receivedFils += p.amount_fils;
    } else {
      row.refundedFils += p.amount_fils;
    }
    row.netFils = row.receivedFils - row.refundedFils;
    rows.set(p.method, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.netFils - a.netFils || a.method.localeCompare(b.method),
  );
}

function expenseRows(facts: Pick<ReportFacts, "expenses">): ExpenseRow[] {
  const rows = new Map<ExpenseCategory, ExpenseRow>();
  for (const e of facts.expenses) {
    const row = rows.get(e.category) ?? { category: e.category, amountFils: 0, count: 0 };
    row.amountFils += e.amount_fils;
    row.count += 1;
    rows.set(e.category, row);
  }
  return [...rows.values()].sort((a, b) => b.amountFils - a.amountFils);
}

/** The whole event report for one scope ("all" or a business day). */
export function buildEventReport(facts: ReportFacts, scope: ReportScope = "all"): EventReport {
  const days = reportDays(facts);
  const allMoney = orderMoney(facts);
  const money = scope === "all" ? allMoney : allMoney.filter((m) => m.day === scope);
  const ids = new Set(money.map((m) => m.order.id));
  const lines = facts.lines.filter((l) => ids.has(l.order_id));
  const { financial } = facts;
  const expenses = financial ? expenseRows(facts) : [];
  const isAll = scope === "all";

  const summary = summarise(money, lines, {
    financial,
    expensesFils: financial && isAll ? expenses.reduce((s, e) => s + e.amountFils, 0) : null,
    feeFils: isAll ? feeFils(facts) : null,
  });

  const byDay: DayRow[] = days.map((day) => {
    const dm = allMoney.filter((m) => m.day === day);
    const dayIds = new Set(dm.map((m) => m.order.id));
    const dl = facts.lines.filter((l) => dayIds.has(l.order_id));
    const s = summarise(dm, dl, { financial, expensesFils: null, feeFils: null });
    return {
      day,
      orders: s.orders,
      units: s.units,
      revenueFils: s.revenueFils,
      netRevenueFils: s.netRevenueFils,
      cogsFils: s.cogsFils,
      grossProfitFils: s.grossProfitFils,
    };
  });

  const ratios: NetRatio = new Map(
    money.map((m) => [m.order.id, { total: m.order.total_fils, vat: m.order.vat_fils }]),
  );
  const byVariant = variantRows(lines, financial, ratios);
  return {
    scope,
    days,
    financial,
    summary,
    byDay,
    byVariant,
    byProduct: groupSales(
      lines,
      (l) => l.product_name,
      (l) => l.product_name,
      financial,
      ratios,
    ),
    byDestination: groupSales(
      lines,
      (l) => l.destination_id ?? "-",
      (l) => l.destination_name ?? NO_DESTINATION,
      financial,
      ratios,
    ),
    byCategory: groupSales(
      lines,
      (l) => l.category_id ?? "-",
      (l) => l.category_name ?? NO_CATEGORY,
      financial,
      ratios,
    ),
    bestSellers: bestSellers(byVariant),
    byMethod: methodRows(facts, ids),
    stock: stockRows(facts, days, scope),
    expenses,
  };
}

export type CompareRow = {
  id: string;
  name: string;
  type: ReportFacts["event"]["type"];
  status: ReportFacts["event"]["status"];
  startDate: string;
  endDate: string;
  days: number;
  orders: number;
  units: number;
  revenueFils: number;
  netRevenueFils: number;
  revenuePerDayFils: number;
  unitsPerDay: number;
  cogsFils: number | null;
  eventCostsFils: number | null;
  grossProfitFils: number | null;
  netProfitFils: number | null;
  grossMarginBp: number | null;
  netMarginBp: number | null;
};

/** One comparison row per event. Days = scheduled event days (start → end). */
export function compareRow(facts: ReportFacts): CompareRow {
  const { summary } = buildEventReport(facts, "all");
  const days = eachBusinessDay(facts.event.start_date, facts.event.end_date).length;
  return {
    id: facts.event.id,
    name: facts.event.name,
    type: facts.event.type,
    status: facts.event.status,
    startDate: facts.event.start_date,
    endDate: facts.event.end_date,
    days,
    orders: summary.orders,
    units: summary.units,
    revenueFils: summary.revenueFils,
    netRevenueFils: summary.netRevenueFils,
    revenuePerDayFils: days ? Math.round(summary.revenueFils / days) : 0,
    unitsPerDay: days ? Math.round((summary.units / days) * 10) / 10 : 0,
    cogsFils: summary.cogsFils,
    eventCostsFils:
      summary.expensesFils === null || summary.feeFils === null
        ? null
        : summary.expensesFils + summary.feeFils,
    grossProfitFils: summary.grossProfitFils,
    netProfitFils: summary.netProfitFils,
    grossMarginBp: summary.grossMarginBp,
    netMarginBp: summary.netMarginBp,
  };
}

/** "25.3%" from basis points; "—" for null. */
export function formatBp(bp: number | null): string {
  if (bp === null) return "—";
  return `${(bp / 100).toFixed(1)}%`;
}
