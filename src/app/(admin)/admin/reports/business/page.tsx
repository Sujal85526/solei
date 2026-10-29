import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { BarList, CompareColumnChart } from "@/components/admin/reports/charts";
import { RangePicker } from "@/components/admin/reports/range-picker";
import {
  ExportButtons,
  Kpi,
  ReportTable,
  type ReportColumn,
} from "@/components/admin/reports/report-parts";
import { ReportsTabs } from "@/components/admin/reports/reports-tabs";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatChange } from "@/modules/dashboard/logic";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/modules/orders/status";
import {
  formatBp,
  rowMarginBp,
  type MethodRow,
  type SalesRow,
  type VariantRow,
} from "@/modules/reports/aggregate";
import {
  headlineChange,
  notSelling,
  type BusinessReport,
  type ChannelRow,
  type MoverRow,
} from "@/modules/reports/business";
import { rangeLabel } from "@/modules/reports/business-tables";
import { businessReport } from "@/modules/reports/queries";
import {
  IDLE_DAY_OPTIONS,
  parseIdleDays,
  parseReportRange,
  type ReportRange,
} from "@/modules/reports/range";

export const metadata: Metadata = { title: "Business report" };

const PATH = "/admin/reports/business";
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-AE")} ${n === 1 ? one : many}`;
const shortDay = (d: string) => formatBusinessDate(d, { day: "numeric", month: "short" });

function vs(cur: number | null, prev: number | null | undefined) {
  const bp = headlineChange(cur, prev);
  return bp === null ? null : `${formatChange(bp)} vs previous period`;
}

export default async function BusinessReportPage({
  searchParams,
}: PageProps<"/admin/reports/business">) {
  const staff = await requirePagePermission("reports.view");
  const sp = await searchParams;
  const range = parseReportRange(sp);
  const idle = parseIdleDays(sp.idle);
  const r = await businessReport(range);
  const fin = r.financial;
  const h = r.headline;
  const p = r.prevHeadline;
  const keep = { idle: String(idle) };
  const exportHref = `${PATH}/export?${new URLSearchParams({ from: range.from, to: range.to, ...keep })}`;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Reports"
        description={
          fin
            ? "Sales, products, customers, stock and profit across every channel."
            : "Sales, products, customers and stock across every channel."
        }
        actions={<ExportButtons href={exportHref} />}
      />
      <div className="-mt-6 -mb-6">
        <ReportsTabs financial={can(staff.permissions, "reports.financial.view")} />
      </div>

      <RangePicker path={PATH} range={range} keep={keep} />
      <p className="text-muted-foreground -mt-3 text-sm" data-testid="report-range">
        {rangeLabel(r.range)} · {plural(r.days, "day")} · compared with {rangeLabel(r.previous)}
      </p>

      <div className={cn("grid grid-cols-2 gap-3", fin ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        <Kpi
          label="Revenue"
          value={formatAED(h.revenueFils)}
          hint={vs(h.revenueFils, p?.revenueFils) ?? "incl. VAT, after refunds"}
          tone="brand"
          testId="kpi-revenue"
        />
        <Kpi
          label="Orders"
          value={h.orders.toLocaleString("en-AE")}
          hint={vs(h.orders, p?.orders)}
        />
        <Kpi
          label="Average order"
          value={h.avgOrderFils === null ? "—" : formatAED(h.avgOrderFils)}
          hint={vs(h.avgOrderFils, p?.avgOrderFils)}
        />
        <Kpi
          label="Units sold"
          value={h.units.toLocaleString("en-AE")}
          hint={vs(h.units, p?.units)}
        />
        {fin && r.pnl ? (
          <Kpi
            label="Est. net profit"
            value={formatAED(r.pnl.netProfitFils)}
            hint={`${formatBp(r.pnl.netMarginBp)} margin`}
            tone={r.pnl.netProfitFils < 0 ? "loss" : undefined}
            testId="kpi-net-profit"
          />
        ) : null}
      </div>

      <SalesOverTime r={r} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Channels rows={r.byChannel} />
        <Methods rows={r.byMethod} />
      </div>

      <Orders r={r} />
      <Products r={r} />
      {r.pnl ? <ProfitAndLoss r={r} canManage={can(staff.permissions, "expenses.manage")} /> : null}
      <Customers r={r} />
      <Stock r={r} idle={idle} range={range} />
      <Months r={r} />
    </div>
  );
}

function SalesOverTime({ r }: { r: BusinessReport }) {
  const unit = r.bucket === "day" ? "day" : r.bucket === "week" ? "week" : "month";
  const cols: ReportColumn<BusinessReport["series"][number]>[] = [
    {
      key: "p",
      header: unit === "week" ? "Week of" : unit === "day" ? "Day" : "Month",
      rowHeader: true,
      cell: (x) => x.label,
    },
    { key: "o", header: "Orders", numeric: true, cell: (x) => x.orders },
    { key: "r", header: "Revenue", numeric: true, cell: (x) => formatAED(x.revenueFils) },
    {
      key: "v",
      header: "Previous period",
      numeric: true,
      cell: (x) => formatAED(x.prevRevenueFils),
    },
  ];
  return (
    <AdminSection
      title="Sales over time"
      description={`Revenue by ${unit}, beside the same position in the previous period.`}
    >
      <div className="flex flex-col gap-5">
        <CompareColumnChart
          label={`Revenue by ${unit}, this period and the previous one`}
          format="aed"
          names={["This period", "Previous period"]}
          data={r.series.map((x) => ({
            label: x.label,
            value: x.revenueFils,
            previous: x.prevRevenueFils,
          }))}
        />
        <details>
          <summary className="text-primary cursor-pointer text-sm font-medium">
            Show as a table
          </summary>
          <div className="mt-3">
            <ReportTable
              caption="Sales over time"
              columns={cols}
              rows={r.series}
              rowKey={(x) => x.start}
            />
          </div>
        </details>
      </div>
    </AdminSection>
  );
}

function Channels({ rows }: { rows: ChannelRow[] }) {
  return (
    <AdminSection
      title="Revenue by channel"
      description="Website, event POS, WhatsApp, direct, payment links, bookings."
    >
      {rows.length ? (
        <div className="flex flex-col gap-4">
          <BarList
            label="Revenue by channel"
            format="aed"
            data={rows.map((c) => ({
              label: CHANNEL_LABELS[c.channel],
              value: c.revenueFils,
              note: plural(c.orders, "order"),
            }))}
          />
          <ReportTable
            caption="Revenue by channel"
            rowKey={(c) => c.channel}
            rows={rows}
            columns={[
              {
                key: "c",
                header: "Channel",
                rowHeader: true,
                cell: (c) => CHANNEL_LABELS[c.channel],
              },
              { key: "o", header: "Orders", numeric: true, cell: (c) => c.orders },
              { key: "r", header: "Revenue", numeric: true, cell: (c) => formatAED(c.revenueFils) },
            ]}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No sales in this period.</p>
      )}
    </AdminSection>
  );
}

function Methods({ rows }: { rows: MethodRow[] }) {
  return (
    <AdminSection
      title="Payment methods"
      description="Money received for this period's orders, less refunds."
    >
      {rows.length ? (
        <div className="flex flex-col gap-4">
          <BarList
            label="Net received by payment method"
            format="aed"
            data={rows.map((m) => ({
              label: PAYMENT_METHOD_LABELS[m.method],
              value: m.netFils,
              note: plural(m.payments, "payment"),
            }))}
          />
          <ReportTable
            caption="Payment methods"
            rowKey={(m) => m.method}
            rows={rows}
            columns={[
              {
                key: "m",
                header: "Method",
                rowHeader: true,
                cell: (m) => PAYMENT_METHOD_LABELS[m.method],
              },
              { key: "n", header: "Payments", numeric: true, cell: (m) => m.payments },
              {
                key: "r",
                header: "Refunded",
                numeric: true,
                cell: (m) => formatAED(m.refundedFils),
              },
              { key: "t", header: "Net", numeric: true, cell: (m) => formatAED(m.netFils) },
            ]}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No payments in this period.</p>
      )}
    </AdminSection>
  );
}

function Orders({ r }: { r: BusinessReport }) {
  const o = r.orders;
  return (
    <AdminSection
      title="Orders"
      description="Every order placed in the period. Revenue counts all except cancelled and unpaid website checkouts."
      actions={
        <Link
          href={`/admin/orders?from=${r.range.from}&to=${r.range.to}`}
          className="text-primary text-sm font-medium hover:underline"
        >
          Open the orders
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total orders" value={o.total} hint={`${o.counted} counted`} />
          <Kpi label="Completed" value={o.completed} hint="completed or delivered" />
          <Kpi label="Cancelled" value={o.cancelled} />
          <Kpi
            label="Awaiting payment"
            value={o.pendingPayment}
            hint="website checkouts not paid"
          />
        </div>
        <ReportTable
          caption="Orders by status"
          rowKey={(s) => s.status}
          rows={o.byStatus}
          empty="No orders in this period."
          columns={[
            {
              key: "s",
              header: "Status",
              rowHeader: true,
              cell: (s) => ORDER_STATUS_LABELS[s.status],
            },
            { key: "o", header: "Orders", numeric: true, cell: (s) => s.orders },
            { key: "v", header: "Order value", numeric: true, cell: (s) => formatAED(s.totalFils) },
          ]}
          footer={["Total", o.total, formatAED(o.byStatus.reduce((t, s) => t + s.totalFils, 0))]}
        />
      </div>
    </AdminSection>
  );
}

function salesColumns(fin: boolean, first: string): ReportColumn<SalesRow>[] {
  return [
    { key: "l", header: first, rowHeader: true, cell: (x) => x.label },
    { key: "u", header: "Units", numeric: true, cell: (x) => x.units },
    { key: "s", header: "Sales", numeric: true, cell: (x) => formatAED(x.salesFils) },
    ...(fin
      ? ([
          { key: "c", header: "COGS", numeric: true, cell: (x) => formatAED(x.cogsFils ?? 0) },
          { key: "m", header: "Margin", numeric: true, cell: (x) => formatBp(rowMarginBp(x)) },
        ] as ReportColumn<SalesRow>[])
      : []),
  ];
}

function Products({ r }: { r: BusinessReport }) {
  const fin = r.financial;
  const variantCols: ReportColumn<VariantRow>[] = [
    ...(salesColumns(fin, "Product") as ReportColumn<VariantRow>[]).slice(0, 1),
    { key: "cat", header: "Category", cell: (v) => v.category },
    ...(salesColumns(fin, "Product") as ReportColumn<VariantRow>[]).slice(1),
  ];
  return (
    <AdminSection
      title="Products & categories"
      description="All channels. Sales are line totals before order discounts and refunds."
    >
      {r.byVariant.length ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Categories</h3>
              <BarList
                label="Sales by category"
                format="aed"
                data={r.byCategory.map((c) => ({
                  label: c.label,
                  value: c.salesFils,
                  note: plural(c.units, "unit"),
                }))}
              />
              <ReportTable
                caption="Sales by category"
                rowKey={(c) => c.key}
                rows={r.byCategory}
                columns={salesColumns(fin, "Category")}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Best sellers (units)</h3>
              <ol className="divide-y text-sm" data-testid="best-sellers">
                {r.bestSellers.map((v, i) => (
                  <li key={v.key} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="text-muted-foreground numeric w-5 text-end">{i + 1}</span>
                      <span className="truncate">{v.label}</span>
                    </span>
                    <span className="numeric shrink-0 text-end">
                      {plural(v.units, "unit")}
                      <span className="text-muted-foreground ms-2">{formatAED(v.salesFils)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <details>
            <summary className="text-primary cursor-pointer text-sm font-medium">
              Every product and size ({r.byVariant.length})
            </summary>
            <div className="mt-3">
              <ReportTable
                caption="Sales by product and size"
                rowKey={(v) => v.key}
                rows={r.byVariant}
                columns={variantCols}
              />
            </div>
          </details>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Nothing sold in this period.</p>
      )}
    </AdminSection>
  );
}

function ProfitAndLoss({ r, canManage }: { r: BusinessReport; canManage: boolean }) {
  const p = r.pnl!;
  const rows: { label: string; value: number; tone?: "sub" | "total"; hint?: string }[] = [
    { label: "Revenue (incl. VAT, after refunds)", value: p.revenueFils },
    { label: "VAT", value: -p.vatFils },
    { label: "Net revenue", value: p.netRevenueFils, tone: "sub" },
    { label: "Product cost (COGS)", value: -p.cogsFils },
    {
      label: "Gross profit",
      value: p.grossProfitFils,
      tone: "sub",
      hint: formatBp(p.grossMarginBp),
    },
    { label: "Event participation fees", value: -p.eventFeesFils },
    { label: "Event expenses", value: -p.eventExpensesFils },
    { label: "Business expenses", value: -p.businessExpensesFils },
    {
      label: "Estimated net profit",
      value: p.netProfitFils,
      tone: "total",
      hint: formatBp(p.netMarginBp),
    },
  ];
  return (
    <AdminSection
      title="Profit & loss"
      description="An estimate, ex VAT: product cost at sale, events that started in the period, business expenses spent in it."
      actions={
        <Link
          href="/admin/reports/expenses"
          className="text-primary text-sm font-medium hover:underline"
        >
          {canManage ? "Add or edit expenses" : "See expenses"}
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="numeric text-sm" data-testid="pnl">
          {rows.map((x) => (
            <div
              key={x.label}
              className={cn(
                "flex items-baseline justify-between gap-3 py-2",
                x.tone === "sub" && "border-t font-medium",
                x.tone === "total" && "border-t-burgundy/40 border-t-2 text-base font-semibold",
              )}
            >
              <dt>{x.label}</dt>
              <dd className={cn("text-end", x.value < 0 && x.tone && "text-destructive")}>
                {formatAED(x.value)}
                {x.hint ? (
                  <span className="text-muted-foreground ms-2 text-xs font-normal">{x.hint}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Business expenses</h3>
            <ReportTable
              caption="Business expenses by category"
              rowKey={(e) => e.category}
              rows={p.expenses}
              empty="No business expenses entered for this period."
              columns={[
                { key: "c", header: "Category", rowHeader: true, cell: (e) => e.category },
                { key: "n", header: "Entries", numeric: true, cell: (e) => e.count },
                { key: "a", header: "Amount", numeric: true, cell: (e) => formatAED(e.amountFils) },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Event costs (fee + expenses)</h3>
            <ReportTable
              caption="Event costs"
              rowKey={(e) => e.id}
              rows={p.events}
              empty="No event costs in this period."
              columns={[
                {
                  key: "e",
                  header: "Event",
                  rowHeader: true,
                  cell: (e) => (
                    <Link href={`/admin/reports/events/${e.id}`} className="hover:underline">
                      {e.name}
                    </Link>
                  ),
                },
                { key: "d", header: "Starts", cell: (e) => shortDay(e.startDate) },
                { key: "a", header: "Costs", numeric: true, cell: (e) => formatAED(e.costsFils) },
              ]}
            />
          </div>
          {p.linesWithoutCost ? (
            <p className="text-muted-foreground flex gap-2 text-xs">
              <Info className="size-4 shrink-0" />
              {plural(p.linesWithoutCost, "line")} sold without a product cost: set costs on the
              products for a truer profit.
            </p>
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}

function Customers({ r }: { r: BusinessReport }) {
  const c = r.customers;
  return (
    <AdminSection
      title="Customers"
      description="New = first order ever in this period. Returning = bought before. Repeat rate = ordered more than once in total."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            label="Customers"
            value={c.customers}
            hint={
              c.guestOrders ? `+ ${plural(c.guestOrders, "order")} without a record` : undefined
            }
          />
          <Kpi label="New" value={c.newCustomers} />
          <Kpi label="Returning" value={c.returning} />
          <Kpi label="Repeat rate" value={formatBp(c.repeatRateBp)} />
        </div>
        {c.customers ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">New and returning over time</h3>
              <CompareColumnChart
                label="New and returning customers over time"
                format="int"
                names={["New", "Returning"]}
                height={200}
                data={c.trend.map((t) => ({
                  label: t.label,
                  value: t.newCustomers,
                  previous: t.returning,
                }))}
              />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">Top spenders</h3>
              <ReportTable
                caption="Top spenders"
                rowKey={(t) => t.id}
                rows={c.top}
                columns={[
                  {
                    key: "n",
                    header: "Customer",
                    rowHeader: true,
                    cell: (t) => (
                      <Link href={`/admin/customers/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    ),
                  },
                  { key: "k", header: "", cell: (t) => (t.isNew ? "New" : "Returning") },
                  { key: "o", header: "Orders", numeric: true, cell: (t) => t.orders },
                  {
                    key: "s",
                    header: "Spent",
                    numeric: true,
                    cell: (t) => formatAED(t.revenueFils),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
}

function moverColumns(fin: boolean): ReportColumn<MoverRow>[] {
  return [
    { key: "l", header: "Product", rowHeader: true, cell: (m) => m.label },
    { key: "s", header: "Sold", numeric: true, cell: (m) => m.unitsSold },
    { key: "d", header: "Per day", numeric: true, cell: (m) => m.perDay.toLocaleString("en-AE") },
    { key: "h", header: "On hand", numeric: true, cell: (m) => m.onHand },
    {
      key: "left",
      header: "Days of stock",
      numeric: true,
      cell: (m) => (m.daysLeft === null ? "—" : m.daysLeft),
    },
    {
      key: "last",
      header: "Last sold",
      numeric: true,
      cell: (m) => (m.lastSoldDay ? shortDay(m.lastSoldDay) : "Never"),
    },
    ...(fin
      ? ([
          {
            key: "v",
            header: "Stock value",
            numeric: true,
            cell: (m) => formatAED(m.valueFils ?? 0),
          },
        ] as ReportColumn<MoverRow>[])
      : []),
  ];
}

function Stock({ r, idle, range }: { r: BusinessReport; idle: number; range: ReportRange }) {
  const fin = r.financial;
  const active = r.movers.filter((m) => m.active || m.onHand > 0);
  const fast = active.filter((m) => m.unitsSold > 0).slice(0, 10);
  const slow = active
    .filter((m) => m.onHand > 0)
    .sort(
      (a, b) => a.unitsSold - b.unitsSold || (b.daysSinceSale ?? 1e9) - (a.daysSinceSale ?? 1e9),
    )
    .slice(0, 10);
  const idleRows = notSelling(active, r.range, idle);
  const cols = moverColumns(fin);
  const q = (n: number) =>
    `${PATH}?${new URLSearchParams(range.preset === "custom" ? { range: "custom", from: range.from, to: range.to, idle: String(n) } : { range: range.preset, idle: String(n) })}`;
  return (
    <AdminSection
      title="Stock: fast and slow movers"
      description="Units sold in the period on every channel, against stock on hand now (all locations). Days of stock = on hand ÷ units a day."
      actions={
        <Link href="/admin/inventory" className="text-primary text-sm font-medium hover:underline">
          Inventory
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Units on hand" value={r.inventory.units.toLocaleString("en-AE")} />
          {fin ? (
            <Kpi
              label="Inventory value"
              value={formatAED(r.inventory.valueFils ?? 0)}
              hint={
                r.inventory.variantsWithoutCost
                  ? `${plural(r.inventory.variantsWithoutCost, "product")} without a cost`
                  : "at unit cost"
              }
              testId="kpi-inventory-value"
            />
          ) : null}
          <Kpi label={`No sale in ${idle} days`} value={idleRows.length} hint="in stock" />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Fastest movers</h3>
          <ReportTable
            caption="Fastest movers"
            rowKey={(m) => m.variantId}
            rows={fast}
            columns={cols}
            empty="Nothing sold in this period."
          />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Slowest movers (in stock)</h3>
          <ReportTable
            caption="Slowest movers"
            rowKey={(m) => m.variantId}
            rows={slow}
            columns={cols}
            empty="No stock on hand."
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">In stock, no sale in {idle} days</h3>
            <nav aria-label="Days without a sale" className="flex gap-1">
              {IDLE_DAY_OPTIONS.map((n) => (
                <Link
                  key={n}
                  href={q(n)}
                  scroll={false}
                  aria-current={n === idle ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs",
                    n === idle ? "bg-burgundy border-burgundy text-cream" : "hover:bg-muted",
                  )}
                >
                  {n} days
                </Link>
              ))}
            </nav>
          </div>
          <ReportTable
            caption={`No sale in ${idle} days`}
            rowKey={(m) => m.variantId}
            rows={idleRows}
            columns={cols}
            empty="Everything in stock sold recently."
          />
        </div>
      </div>
    </AdminSection>
  );
}

function Months({ r }: { r: BusinessReport }) {
  const { year, rows } = r.months;
  return (
    <AdminSection
      title={`${year} month by month`}
      description={`Revenue each month beside ${year - 1}: growth and seasons.`}
    >
      <div className="flex flex-col gap-5">
        <CompareColumnChart
          label={`Revenue by month, ${year} and ${year - 1}`}
          format="aed"
          names={[String(year), String(year - 1)]}
          data={rows.map((m) => ({
            label: m.label,
            value: m.revenueFils,
            previous: m.prevRevenueFils,
          }))}
        />
        <details>
          <summary className="text-primary cursor-pointer text-sm font-medium">
            Show as a table
          </summary>
          <div className="mt-3">
            <ReportTable
              caption="Revenue by month"
              rowKey={(m) => m.month}
              rows={rows}
              columns={[
                { key: "m", header: "Month", rowHeader: true, cell: (m) => m.label },
                { key: "o", header: `Orders ${year}`, numeric: true, cell: (m) => m.orders },
                {
                  key: "r",
                  header: `Revenue ${year}`,
                  numeric: true,
                  cell: (m) => formatAED(m.revenueFils),
                },
                {
                  key: "po",
                  header: `Orders ${year - 1}`,
                  numeric: true,
                  cell: (m) => m.prevOrders,
                },
                {
                  key: "pr",
                  header: `Revenue ${year - 1}`,
                  numeric: true,
                  cell: (m) => formatAED(m.prevRevenueFils),
                },
              ]}
              footer={[
                "Total",
                rows.reduce((t, m) => t + m.orders, 0),
                formatAED(rows.reduce((t, m) => t + m.revenueFils, 0)),
                rows.reduce((t, m) => t + m.prevOrders, 0),
                formatAED(rows.reduce((t, m) => t + m.prevRevenueFils, 0)),
              ]}
            />
          </div>
        </details>
      </div>
    </AdminSection>
  );
}
