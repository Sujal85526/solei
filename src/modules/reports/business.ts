/**
 * Business-wide report roll-ups. Pure functions over the facts returned by
 * `business_report_data()`, with the event-report rules (see aggregate.ts):
 *
 * - Counted orders: everything except `cancelled` and unpaid website checkouts.
 * - Revenue = order totals − refunds (VAT-inclusive); profit is ex VAT. COGS = Σ qty × cost
 *   (cost snapshot at sale, else today's variant cost — the database picks).
 * - Net profit = gross profit − event fees − event expenses − business expenses. Events count in
 *   the range they start in; business expenses on the day they were spent.
 * - Customers: "new" = first counted order ever falls in the range; "returning" = bought before.
 *   Repeat rate = share of the range's customers who have ordered more than once in total.
 * - Stock: on hand at every location (events included). Inventory value = on hand × unit cost.
 *
 * Every cost figure is null without reports.financial.view (the database already leaves them out).
 */
import { formatBusinessDate } from "@/lib/dates";
import { changeBp } from "@/modules/dashboard/logic";
import type { OrderChannel } from "@/modules/orders/status";
import {
  bestSellers,
  groupSales,
  isCounted,
  methodRows,
  orderMoney,
  ratioBp,
  summarise,
  variantRows,
  type MethodRow,
  type NetRatio,
  type SalesRow,
  type Summary,
  type VariantRow,
} from "./aggregate";
import {
  addDays,
  bucketFor,
  bucketStart,
  bucketsOf,
  previousRange,
  rangeDays,
  type Bucket,
  type DayRange,
} from "./range";
import type { LineFact, OrderFact, OrderStatus, PaymentFact } from "./types";

// ─── Facts (shape of business_report_data) ──────────────────────────────────────────────────

export type BizOrderFact = {
  id: string;
  /** Asia/Dubai business day (POS event_day, else placed_at) */
  day: string;
  status: OrderStatus;
  channel: OrderChannel;
  total_fils: number;
  vat_fils: number;
  discount_fils: number;
  customer_id: string | null;
  event_id: string | null;
};

export type EventCostFact = {
  id: string;
  name: string;
  start_date: string;
  fee_fils: number;
  expenses_fils: number;
};

export type ExpenseTotalFact = { category: string; amount_fils: number; count: number };

export type CustomerFact = {
  id: string;
  name: string;
  first_day: string;
  lifetime_orders: number;
};

export type MonthFact = { month: string; orders: number; revenue_fils: number };

export type StockLevelFact = {
  variant_id: string;
  product_name: string;
  variant_label: string;
  sku: string;
  category_name: string | null;
  active: boolean;
  on_hand: number;
  /** null without reports.financial.view */
  cost_fils: number | null;
  last_sold_day: string | null;
};

export type BusinessFacts = {
  from: string;
  to: string;
  financial: boolean;
  orders: BizOrderFact[];
  lines: LineFact[];
  payments: PaymentFact[];
  events: EventCostFact[];
  expenses: ExpenseTotalFact[];
  /** Empty in the compact form (previous period, dashboard). */
  customers: CustomerFact[];
  months: MonthFact[];
  stock: StockLevelFact[];
};

// ─── Report shape ───────────────────────────────────────────────────────────────────────────

export type ProfitAndLoss = {
  revenueFils: number;
  vatFils: number;
  netRevenueFils: number;
  cogsFils: number;
  grossProfitFils: number;
  grossMarginBp: number | null;
  eventFeesFils: number;
  eventExpensesFils: number;
  businessExpensesFils: number;
  netProfitFils: number;
  netMarginBp: number | null;
  linesWithoutCost: number;
  expenses: { category: string; amountFils: number; count: number }[];
  events: { id: string; name: string; startDate: string; costsFils: number }[];
};

export type SeriesRow = {
  start: string;
  label: string;
  orders: number;
  revenueFils: number;
  /** Same position in the previous period. */
  prevRevenueFils: number;
};

export type ChannelRow = { channel: OrderChannel; orders: number; revenueFils: number };

export type OrderReport = {
  /** Every order placed in the range, any status. */
  total: number;
  counted: number;
  byStatus: { status: OrderStatus; orders: number; totalFils: number }[];
  completed: number;
  cancelled: number;
  pendingPayment: number;
  avgOrderFils: number | null;
};

export type CustomerReport = {
  customers: number;
  newCustomers: number;
  returning: number;
  /** Counted orders without a customer record. */
  guestOrders: number;
  repeatRateBp: number | null;
  top: { id: string; name: string; orders: number; revenueFils: number; isNew: boolean }[];
  trend: { start: string; label: string; newCustomers: number; returning: number }[];
};

export type MoverRow = {
  variantId: string;
  label: string;
  sku: string;
  category: string;
  active: boolean;
  onHand: number;
  unitsSold: number;
  revenueFils: number;
  /** Average units a day over the range. */
  perDay: number;
  /** On hand ÷ daily rate; null when nothing sold (no rate to go on). */
  daysLeft: number | null;
  lastSoldDay: string | null;
  /** Days since the last sale up to the end of the range; null when never sold. */
  daysSinceSale: number | null;
  unitCostFils: number | null;
  valueFils: number | null;
};

export type InventoryValue = {
  units: number;
  /** null without reports.financial.view */
  valueFils: number | null;
  variantsWithoutCost: number;
};

export type MonthRow = {
  month: string;
  label: string;
  revenueFils: number;
  orders: number;
  prevRevenueFils: number;
  prevOrders: number;
};

export type Headline = {
  revenueFils: number;
  orders: number;
  units: number;
  avgOrderFils: number | null;
  netProfitFils: number | null;
};

export type BusinessReport = {
  range: DayRange;
  previous: DayRange;
  days: number;
  bucket: Bucket;
  financial: boolean;
  summary: Summary;
  headline: Headline;
  prevHeadline: Headline | null;
  pnl: ProfitAndLoss | null;
  series: SeriesRow[];
  byChannel: ChannelRow[];
  byMethod: MethodRow[];
  byCategory: SalesRow[];
  byProduct: SalesRow[];
  byVariant: VariantRow[];
  bestSellers: VariantRow[];
  orders: OrderReport;
  customers: CustomerReport;
  movers: MoverRow[];
  inventory: InventoryValue;
  months: { year: number; rows: MonthRow[] };
};

// ─── Roll-ups ───────────────────────────────────────────────────────────────────────────────

/** The event-report helpers take OrderFact; the business day is already resolved here. */
const asOrderFact = (o: BizOrderFact): OrderFact => ({
  id: o.id,
  number: "",
  event_day: o.day,
  placed_at: o.day,
  status: o.status,
  channel: o.channel,
  total_fils: o.total_fils,
  vat_fils: o.vat_fils,
  discount_fils: o.discount_fils,
});

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

export function bucketLabel(start: string, bucket: Bucket): string {
  if (bucket === "month") return formatBusinessDate(start, { month: "short", year: "2-digit" });
  if (bucket === "week") return formatBusinessDate(start, { day: "numeric", month: "short" });
  return formatBusinessDate(start, { day: "numeric", month: "short" });
}

/** Money facts of the counted orders, with refunds applied. */
function moneyOf(facts: Pick<BusinessFacts, "orders" | "payments">) {
  return orderMoney({ orders: facts.orders.map(asOrderFact), payments: facts.payments });
}

export function profitAndLoss(facts: BusinessFacts, summary: Summary): ProfitAndLoss | null {
  if (!facts.financial || summary.cogsFils === null || summary.grossProfitFils === null)
    return null;
  const eventFeesFils = sum(facts.events, (e) => e.fee_fils);
  const eventExpensesFils = sum(facts.events, (e) => e.expenses_fils);
  const businessExpensesFils = sum(facts.expenses, (e) => e.amount_fils);
  const netProfitFils =
    summary.grossProfitFils - eventFeesFils - eventExpensesFils - businessExpensesFils;
  return {
    revenueFils: summary.revenueFils,
    vatFils: summary.vatFils,
    netRevenueFils: summary.netRevenueFils,
    cogsFils: summary.cogsFils,
    grossProfitFils: summary.grossProfitFils,
    grossMarginBp: summary.grossMarginBp,
    eventFeesFils,
    eventExpensesFils,
    businessExpensesFils,
    netProfitFils,
    netMarginBp: ratioBp(netProfitFils, summary.netRevenueFils),
    linesWithoutCost: summary.linesWithoutCost,
    expenses: facts.expenses.map((e) => ({
      category: e.category,
      amountFils: e.amount_fils,
      count: e.count,
    })),
    events: facts.events
      .map((e) => ({
        id: e.id,
        name: e.name,
        startDate: e.start_date,
        costsFils: e.fee_fils + e.expenses_fils,
      }))
      .filter((e) => e.costsFils > 0),
  };
}

/** Headline figures of a period (also for the previous period and the dashboard). */
export function headline(facts: BusinessFacts): { summary: Summary; headline: Headline } {
  const money = moneyOf(facts);
  const ids = new Set(money.map((m) => m.order.id));
  const lines = facts.lines.filter((l) => ids.has(l.order_id));
  const summary = summarise(money, lines, {
    financial: facts.financial,
    expensesFils: null,
    feeFils: null,
  });
  const pnl = profitAndLoss(facts, summary);
  return {
    summary,
    headline: {
      revenueFils: summary.revenueFils,
      orders: summary.orders,
      units: summary.units,
      avgOrderFils: summary.avgOrderFils,
      netProfitFils: pnl?.netProfitFils ?? null,
    },
  };
}

function revenueByBucket(
  facts: Pick<BusinessFacts, "orders" | "payments">,
  range: DayRange,
  bucket: Bucket,
) {
  const starts = bucketsOf(range, bucket);
  const rows = new Map(starts.map((s) => [s, { orders: 0, revenueFils: 0 }]));
  for (const m of moneyOf(facts)) {
    const row = rows.get(bucketStart(m.day, bucket));
    if (!row) continue;
    row.orders += 1;
    row.revenueFils += m.revenueFils;
  }
  return starts.map((start) => ({ start, ...rows.get(start)! }));
}

export function salesSeries(
  facts: BusinessFacts,
  prev: Pick<BusinessFacts, "orders" | "payments"> | null,
  range: DayRange,
  bucket: Bucket,
): SeriesRow[] {
  const cur = revenueByBucket(facts, range, bucket);
  const before = prev ? revenueByBucket(prev, previousRange(range), bucket) : [];
  return cur.map((c, i) => ({
    start: c.start,
    label: bucketLabel(c.start, bucket),
    orders: c.orders,
    revenueFils: c.revenueFils,
    prevRevenueFils: before[i]?.revenueFils ?? 0,
  }));
}

export function channelRows(facts: Pick<BusinessFacts, "orders" | "payments">): ChannelRow[] {
  const rows = new Map<OrderChannel, ChannelRow>();
  for (const m of moneyOf(facts)) {
    const row = rows.get(m.order.channel) ?? {
      channel: m.order.channel,
      orders: 0,
      revenueFils: 0,
    };
    row.orders += 1;
    row.revenueFils += m.revenueFils;
    rows.set(m.order.channel, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.revenueFils - a.revenueFils || a.channel.localeCompare(b.channel),
  );
}

export function orderReport(facts: Pick<BusinessFacts, "orders" | "payments">): OrderReport {
  const byStatus = new Map<
    OrderStatus,
    { status: OrderStatus; orders: number; totalFils: number }
  >();
  for (const o of facts.orders) {
    const row = byStatus.get(o.status) ?? { status: o.status, orders: 0, totalFils: 0 };
    row.orders += 1;
    row.totalFils += o.total_fils;
    byStatus.set(o.status, row);
  }
  const money = moneyOf(facts);
  const count = (s: OrderStatus) => byStatus.get(s)?.orders ?? 0;
  const revenue = sum(money, (m) => m.revenueFils);
  return {
    total: facts.orders.length,
    counted: money.length,
    byStatus: [...byStatus.values()].sort((a, b) => b.orders - a.orders),
    completed: count("completed") + count("delivered"),
    cancelled: count("cancelled"),
    pendingPayment: count("pending_payment"),
    avgOrderFils: money.length ? Math.round(revenue / money.length) : null,
  };
}

export function customerReport(
  facts: Pick<BusinessFacts, "orders" | "payments" | "customers">,
  range: DayRange,
  bucket: Bucket,
  topN = 10,
): CustomerReport {
  const known = new Map(facts.customers.map((c) => [c.id, c]));
  const money = moneyOf(facts);
  const customerOf = new Map(facts.orders.map((o) => [o.id, o.customer_id]));
  const per = new Map<string, { orders: number; revenueFils: number; days: string[] }>();
  let guestOrders = 0;
  for (const m of money) {
    const id = customerOf.get(m.order.id);
    if (!id || !known.has(id)) {
      guestOrders += 1;
      continue;
    }
    const row = per.get(id) ?? { orders: 0, revenueFils: 0, days: [] };
    row.orders += 1;
    row.revenueFils += m.revenueFils;
    row.days.push(m.day);
    per.set(id, row);
  }
  const isNew = (id: string) => known.get(id)!.first_day >= range.from;
  const ids = [...per.keys()];
  const newCustomers = ids.filter(isNew).length;
  const repeaters = ids.filter((id) => known.get(id)!.lifetime_orders > 1).length;

  // Trend: each customer counts once, in the bucket of their first order in the range.
  const starts = bucketsOf(range, bucket);
  const trend = new Map(starts.map((s) => [s, { newCustomers: 0, returning: 0 }]));
  for (const [id, row] of per) {
    const first = [...row.days].sort()[0]!;
    const t = trend.get(bucketStart(first, bucket));
    if (!t) continue;
    if (isNew(id)) t.newCustomers += 1;
    else t.returning += 1;
  }

  return {
    customers: ids.length,
    newCustomers,
    returning: ids.length - newCustomers,
    guestOrders,
    repeatRateBp: ratioBp(repeaters, ids.length),
    top: ids
      .map((id) => ({
        id,
        name: known.get(id)!.name,
        orders: per.get(id)!.orders,
        revenueFils: per.get(id)!.revenueFils,
        isNew: isNew(id),
      }))
      .sort(
        (a, b) =>
          b.revenueFils - a.revenueFils || b.orders - a.orders || a.name.localeCompare(b.name),
      )
      .slice(0, topN),
    trend: starts.map((start) => ({
      start,
      label: bucketLabel(start, bucket),
      ...trend.get(start)!,
    })),
  };
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Every stocked / active variant with what it sold in the range (fast first). */
export function moverRows(
  stock: StockLevelFact[],
  byVariant: VariantRow[],
  range: DayRange,
): MoverRow[] {
  const sold = new Map(byVariant.map((v) => [v.key, v]));
  const days = rangeDays(range);
  return stock
    .map((s) => {
      const v = sold.get(s.variant_id);
      const unitsSold = v?.units ?? 0;
      const perDay = unitsSold / days;
      return {
        variantId: s.variant_id,
        label: s.variant_label ? `${s.product_name} · ${s.variant_label}` : s.product_name,
        sku: s.sku,
        category: s.category_name ?? "Uncategorised",
        active: s.active,
        onHand: s.on_hand,
        unitsSold,
        revenueFils: v?.salesFils ?? 0,
        perDay: Math.round(perDay * 10) / 10,
        daysLeft: perDay > 0 ? Math.floor(Math.max(0, s.on_hand) / perDay) : null,
        lastSoldDay: s.last_sold_day,
        daysSinceSale: s.last_sold_day
          ? Math.max(0, dayDiff(s.last_sold_day < range.to ? s.last_sold_day : range.to, range.to))
          : null,
        unitCostFils: s.cost_fils,
        valueFils: s.cost_fils === null ? null : Math.max(0, s.on_hand) * s.cost_fils,
      };
    })
    .sort(
      (a, b) =>
        b.unitsSold - a.unitsSold ||
        b.revenueFils - a.revenueFils ||
        a.label.localeCompare(b.label),
    );
}

/** In stock but not sold for `days` days up to the end of the range (or never), oldest first. */
export function notSelling(movers: MoverRow[], range: DayRange, days: number): MoverRow[] {
  const cutoff = addDays(range.to, -days);
  return movers
    .filter((m) => m.onHand > 0 && (!m.lastSoldDay || m.lastSoldDay <= cutoff))
    .sort(
      (a, b) =>
        (a.lastSoldDay ?? "").localeCompare(b.lastSoldDay ?? "") || a.label.localeCompare(b.label),
    );
}

/** Units on hand (positive only) and their value at unit cost. */
export function inventoryValue(
  stock: Pick<StockLevelFact, "on_hand" | "cost_fils">[],
  financial: boolean,
): InventoryValue {
  const held = stock.filter((s) => s.on_hand > 0);
  return {
    units: sum(held, (s) => s.on_hand),
    valueFils: financial ? sum(held, (s) => s.on_hand * (s.cost_fils ?? 0)) : null,
    variantsWithoutCost: financial ? held.filter((s) => !s.cost_fils).length : 0,
  };
}

/** Jan → Dec of `year` beside the year before. */
export function monthRows(months: MonthFact[], year: number): MonthRow[] {
  const at = new Map(months.map((m) => [m.month, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const cur = at.get(`${year}-${mm}`);
    const prev = at.get(`${year - 1}-${mm}`);
    return {
      month: `${year}-${mm}`,
      label: formatBusinessDate(`${year}-${mm}-01`, { month: "short" }),
      revenueFils: cur?.revenue_fils ?? 0,
      orders: cur?.orders ?? 0,
      prevRevenueFils: prev?.revenue_fils ?? 0,
      prevOrders: prev?.orders ?? 0,
    };
  });
}

/** Change of a headline figure vs the previous period, in basis points. */
export const headlineChange = (cur: number | null, prev: number | null | undefined) =>
  cur === null || prev === null || prev === undefined ? null : changeBp(cur, prev);

/** The whole business report for a range; `prev` = compact facts of the previous period. */
export function buildBusinessReport(
  facts: BusinessFacts,
  prev: BusinessFacts | null,
): BusinessReport {
  const range = { from: facts.from, to: facts.to };
  const bucket = bucketFor(range);
  const { summary, headline: head } = headline(facts);
  const money = moneyOf(facts);
  const ids = new Set(money.map((m) => m.order.id));
  const lines = facts.lines.filter((l) => ids.has(l.order_id));
  const ratios: NetRatio = new Map(
    money.map((m) => [m.order.id, { total: m.order.total_fils, vat: m.order.vat_fils }]),
  );
  const { financial } = facts;
  const byVariant = variantRows(lines, financial, ratios);
  const year = Number(facts.to.slice(0, 4));

  return {
    range,
    previous: previousRange(range),
    days: rangeDays(range),
    bucket,
    financial,
    summary,
    headline: head,
    prevHeadline: prev ? headline(prev).headline : null,
    pnl: profitAndLoss(facts, summary),
    series: salesSeries(facts, prev, range, bucket),
    byChannel: channelRows(facts),
    byMethod: methodRows({ payments: facts.payments }, ids),
    byCategory: groupSales(
      lines,
      (l) => l.category_id ?? "-",
      (l) => l.category_name ?? "Uncategorised",
      financial,
      ratios,
    ),
    byProduct: groupSales(
      lines,
      (l) => l.product_name,
      (l) => l.product_name,
      financial,
      ratios,
    ),
    byVariant,
    bestSellers: bestSellers(byVariant, 10),
    orders: orderReport(facts),
    customers: customerReport(facts, range, bucket),
    movers: moverRows(facts.stock, byVariant, range),
    inventory: inventoryValue(facts.stock, financial),
    months: { year, rows: monthRows(facts.months, year) },
  };
}

export { isCounted };
