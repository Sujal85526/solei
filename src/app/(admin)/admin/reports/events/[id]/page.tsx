import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { StatusBadge, TypeLabel } from "@/components/admin/events/event-style";
import { PageHeader } from "@/components/admin/page-header";
import { BarList, ColumnChart } from "@/components/admin/reports/charts";
import {
  ExportButtons,
  Kpi,
  LinkTabs,
  ReportTable,
  type ReportColumn,
} from "@/components/admin/reports/report-parts";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { expenseCategoryLabels } from "@/modules/events/schema";
import { PAYMENT_METHOD_LABELS } from "@/modules/orders/status";
import {
  buildEventReport,
  formatBp,
  ratioBp,
  rowMarginBp,
  stockTotals,
  type DayRow,
  type MethodRow,
  type SalesRow,
  type StockRow,
  type VariantRow,
} from "@/modules/reports/aggregate";
import { isUuid, parseScope } from "@/modules/reports/params";
import { eventReportFacts } from "@/modules/reports/queries";
import { eventDates, eventPlace } from "@/modules/reports/tables";

export const metadata: Metadata = { title: "Event report" };

const shortDay = (d: string) =>
  formatBusinessDate(d, { weekday: "short", day: "numeric", month: "short" });
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-AE")} ${n === 1 ? one : many}`;

export default async function EventReportPage({
  params,
  searchParams,
}: PageProps<"/admin/reports/events/[id]">) {
  await requirePagePermission("reports.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const [facts] = await eventReportFacts([id]);
  if (!facts) notFound();

  const days = buildEventReport(facts, "all").days;
  const scope = parseScope(sp.day, days);
  const r = buildEventReport(facts, scope);
  const all = scope === "all" ? r : buildEventReport(facts, "all");
  const s = r.summary;
  const fin = r.financial;
  const isAll = scope === "all";
  const scopeLabel = isAll ? "all days" : shortDay(scope);
  const base = `/admin/reports/events/${facts.event.id}`;
  const place = eventPlace(facts.event);
  const units = s.units;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link
        href="/admin/reports"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Reports
      </Link>
      <div>
        <PageHeader
          title={facts.event.name}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusBadge status={facts.event.status} />
              <TypeLabel type={facts.event.type} className="text-sm" />
              <span>{eventDates(facts.event)}</span>
              {place ? <span>{place}</span> : null}
            </span>
          }
          actions={<ExportButtons href={`${base}/export`} />}
        />
        <LinkTabs
          label="Report days"
          items={[
            { key: "all", href: base, label: "All days", current: isAll },
            ...days.map((d, i) => ({
              key: d,
              href: `${base}?day=${d}`,
              current: d === scope,
              label: (
                <>
                  <span className="text-muted-foreground me-1.5 text-xs">Day {i + 1}</span>
                  {shortDay(d)}
                </>
              ),
            })),
          ]}
        />
      </div>

      <section aria-label={`Totals for ${scopeLabel}`} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="report-kpis">
          <Kpi
            label="Revenue"
            value={formatAED(s.revenueFils)}
            hint={s.refundsFils ? `after ${formatAED(s.refundsFils)} refunds` : "incl. VAT"}
            tone="brand"
            testId="kpi-revenue"
          />
          <Kpi
            label="Units sold"
            value={units.toLocaleString("en-AE")}
            hint={plural(s.orders, "order")}
            testId="kpi-units"
          />
          <Kpi
            label="Average order"
            value={s.avgOrderFils === null ? "—" : formatAED(s.avgOrderFils)}
            hint={s.orders ? `${(units / s.orders).toFixed(1)} units per order` : undefined}
          />
          <Kpi
            label="Net of VAT"
            value={formatAED(s.netRevenueFils)}
            hint={`VAT ${formatAED(s.vatFils)}`}
          />
          {fin ? (
            <>
              <Kpi
                label="COGS"
                value={formatAED(s.cogsFils ?? 0)}
                hint="from cost at time of sale"
                testId="kpi-cogs"
              />
              <Kpi
                label="Gross profit"
                value={formatAED(s.grossProfitFils ?? 0)}
                hint={`${formatBp(s.grossMarginBp)} margin`}
                tone={(s.grossProfitFils ?? 0) < 0 ? "loss" : undefined}
                testId="kpi-gross-profit"
              />
              {isAll ? (
                <>
                  <Kpi
                    label="Expenses + fee"
                    value={formatAED((s.expensesFils ?? 0) + (s.feeFils ?? 0))}
                    hint={`fee ${formatAED(s.feeFils ?? 0)}`}
                  />
                  <Kpi
                    label="Net profit"
                    value={formatAED(s.netProfitFils ?? 0)}
                    hint={`${formatBp(s.netMarginBp)} net margin`}
                    tone={(s.netProfitFils ?? 0) < 0 ? "loss" : undefined}
                    testId="kpi-net-profit"
                  />
                </>
              ) : null}
            </>
          ) : null}
        </div>
        {fin && !isAll ? (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            Expenses and the participation fee belong to the whole event — net profit is under All
            days.
          </p>
        ) : null}
        {fin && s.linesWithoutCost ? (
          <p className="flex items-start gap-1.5 text-xs text-[#8A5108]">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {plural(s.linesWithoutCost, "line")} had no cost snapshot and count as zero cost.
          </p>
        ) : null}
      </section>

      {s.orders === 0 ? (
        <AdminSection>
          <p className="text-muted-foreground text-sm" data-testid="report-empty">
            No sales {isAll ? "for this event yet" : "on this day"}. Sales made at the event POS
            appear here automatically.
          </p>
        </AdminSection>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminSection
          title="Revenue by day"
          description={isAll ? "After refunds, incl. VAT." : `${shortDay(scope)} highlighted.`}
          className="lg:col-span-2"
        >
          <ColumnChart
            label={`Revenue by day: ${all.byDay.map((d) => `${shortDay(d.day)} ${formatAED(d.revenueFils)}`).join(", ")}`}
            format="aed"
            data={all.byDay.map((d) => ({
              label: shortDay(d.day),
              value: d.revenueFils,
              note: `${plural(d.units, "unit")} · ${plural(d.orders, "order")}`,
              muted: !isAll && d.day !== scope,
            }))}
          />
          <div className="mt-4">
            <DayTable rows={all.byDay} financial={fin} summary={all.summary} scope={scope} />
          </div>
        </AdminSection>

        <AdminSection title="Best sellers" description={`By units, ${scopeLabel}.`}>
          {r.bestSellers.length ? (
            <ol className="flex flex-col divide-y" data-testid="best-sellers">
              {r.bestSellers.map((v, i) => (
                <li key={v.key} className="flex items-center gap-3 py-2.5">
                  <span className="bg-pink-wash text-burgundy numeric grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{v.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {v.destination} · {v.category}
                    </span>
                  </span>
                  <span className="text-end">
                    <span className="numeric block text-sm font-semibold">
                      {plural(v.units, "unit")}
                    </span>
                    <span className="numeric text-muted-foreground text-xs">
                      {formatAED(v.salesFils)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground text-sm">No sales yet.</p>
          )}
        </AdminSection>

        <AdminSection title="Category split" description={`Units, ${scopeLabel}.`}>
          <GroupChart rows={r.byCategory} total={units} label="Units by category" />
          <GroupTable rows={r.byCategory} total={units} name="Category" />
        </AdminSection>

        <AdminSection
          title="Units by destination"
          description={`${scopeLabel[0].toUpperCase()}${scopeLabel.slice(1)}.`}
        >
          <GroupChart rows={r.byDestination} total={units} label="Units by destination" />
          <GroupTable rows={r.byDestination} total={units} name="Destination" />
        </AdminSection>

        <AdminSection
          title="Payment methods"
          description={`Money received less refunds, ${scopeLabel}.`}
        >
          <BarList
            label={`Payment methods: ${r.byMethod.map((m) => `${PAYMENT_METHOD_LABELS[m.method]} ${formatAED(m.netFils)}`).join(", ")}`}
            format="aed"
            data={r.byMethod.map((m) => ({
              label: PAYMENT_METHOD_LABELS[m.method],
              value: m.netFils,
              note: plural(m.payments, "payment"),
            }))}
          />
          <MethodTable rows={r.byMethod} />
        </AdminSection>

        <AdminSection
          title="Units by product"
          description={`Sales are line totals before order discounts and refunds.`}
          className="lg:col-span-2"
        >
          <VariantTable rows={r.byVariant} financial={fin} />
        </AdminSection>

        <AdminSection
          title="Stock"
          description={
            isAll
              ? "Allocated → sold → returned to main stock."
              : "Movements on this day; Closing is what was left at the event that evening."
          }
          className="lg:col-span-2"
        >
          <StockTable rows={r.stock} isAll={isAll} />
        </AdminSection>

        {fin && isAll ? (
          <AdminSection
            title="Expenses"
            description="Event costs and the participation fee."
            className="lg:col-span-2"
          >
            <ExpenseTable report={r} />
          </AdminSection>
        ) : null}
      </div>
    </div>
  );
}

function DayTable({
  rows,
  financial,
  summary,
  scope,
}: {
  rows: DayRow[];
  financial: boolean;
  summary: ReturnType<typeof buildEventReport>["summary"];
  scope: string;
}) {
  const cols: ReportColumn<DayRow>[] = [
    {
      key: "day",
      header: "Day",
      rowHeader: true,
      cell: (d) => (
        <span className={d.day === scope ? "text-burgundy font-semibold" : "font-medium"}>
          {shortDay(d.day)}
        </span>
      ),
    },
    { key: "orders", header: "Orders", numeric: true, cell: (d) => d.orders },
    { key: "units", header: "Units", numeric: true, cell: (d) => d.units },
    { key: "rev", header: "Revenue", numeric: true, cell: (d) => formatAED(d.revenueFils) },
  ];
  if (financial) {
    cols.push(
      { key: "cogs", header: "COGS", numeric: true, cell: (d) => formatAED(d.cogsFils ?? 0) },
      {
        key: "gp",
        header: "Gross profit",
        numeric: true,
        cell: (d) => formatAED(d.grossProfitFils ?? 0),
      },
      {
        key: "gm",
        header: "Margin",
        numeric: true,
        cell: (d) => formatBp(ratioBp(d.grossProfitFils ?? 0, d.netRevenueFils)),
      },
    );
  }
  return (
    <ReportTable
      caption="Sales by day"
      columns={cols}
      rows={rows}
      rowKey={(d) => d.day}
      testId="day-table"
      footer={[
        "Total",
        summary.orders,
        summary.units,
        formatAED(summary.revenueFils),
        ...(financial
          ? [
              formatAED(summary.cogsFils ?? 0),
              formatAED(summary.grossProfitFils ?? 0),
              formatBp(summary.grossMarginBp),
            ]
          : []),
      ]}
    />
  );
}

function GroupChart({ rows, total, label }: { rows: SalesRow[]; total: number; label: string }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => b.units - a.units);
  return (
    <div className="mb-3">
      <BarList
        label={`${label}: ${sorted.map((g) => `${g.label} ${g.units}`).join(", ")}`}
        format="int"
        data={sorted.map((g) => ({
          label: g.label,
          value: g.units,
          note: `${formatBp(ratioBp(g.units, total))} of units · ${formatAED(g.salesFils)}`,
        }))}
      />
    </div>
  );
}

function GroupTable({ rows, total, name }: { rows: SalesRow[]; total: number; name: string }) {
  return (
    <ReportTable
      caption={`Units and sales by ${name.toLowerCase()}`}
      columns={[
        { key: "l", header: name, rowHeader: true, cell: (g) => g.label },
        { key: "u", header: "Units", numeric: true, cell: (g) => g.units },
        {
          key: "s",
          header: "Share",
          numeric: true,
          cell: (g) => formatBp(ratioBp(g.units, total)),
        },
        { key: "v", header: "Sales", numeric: true, cell: (g) => formatAED(g.salesFils) },
      ]}
      rows={rows}
      rowKey={(g) => g.key}
      empty="No sales."
    />
  );
}

function MethodTable({ rows }: { rows: MethodRow[] }) {
  const sum = (f: (m: MethodRow) => number) => rows.reduce((t, m) => t + f(m), 0);
  return (
    <div className="mt-3">
      <ReportTable
        caption="Payments by method"
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
            cell: (m) => (m.refundedFils ? formatAED(m.refundedFils) : "—"),
          },
          { key: "net", header: "Net", numeric: true, cell: (m) => formatAED(m.netFils) },
        ]}
        rows={rows}
        rowKey={(m) => m.method}
        testId="method-table"
        empty="No payments."
        footer={[
          "Total",
          sum((m) => m.payments),
          formatAED(sum((m) => m.refundedFils)),
          formatAED(sum((m) => m.netFils)),
        ]}
      />
    </div>
  );
}

function VariantTable({ rows, financial }: { rows: VariantRow[]; financial: boolean }) {
  const cols: ReportColumn<VariantRow>[] = [
    {
      key: "p",
      header: "Product",
      rowHeader: true,
      cell: (v) => (
        <>
          <span className="block font-medium">{v.label}</span>
          <span className="text-muted-foreground text-xs">{v.sku}</span>
        </>
      ),
    },
    { key: "c", header: "Category", cell: (v) => v.category },
    { key: "d", header: "Destination", cell: (v) => v.destination },
    { key: "u", header: "Units", numeric: true, cell: (v) => v.units },
    { key: "s", header: "Sales", numeric: true, cell: (v) => formatAED(v.salesFils) },
  ];
  if (financial) {
    cols.push(
      { key: "cogs", header: "COGS", numeric: true, cell: (v) => formatAED(v.cogsFils ?? 0) },
      {
        key: "m",
        header: "Margin",
        numeric: true,
        cell: (v) => formatBp(rowMarginBp(v)),
      },
    );
  }
  return (
    <ReportTable
      caption="Units and sales by product"
      columns={cols}
      rows={rows}
      rowKey={(v) => v.key}
      testId="variant-table"
      empty="No sales."
      footer={[
        "Total",
        "",
        "",
        rows.reduce((t, v) => t + v.units, 0),
        formatAED(rows.reduce((t, v) => t + v.salesFils, 0)),
        ...(financial ? [formatAED(rows.reduce((t, v) => t + (v.cogsFils ?? 0), 0)), ""] : []),
      ]}
    />
  );
}

function StockTable({ rows, isAll }: { rows: StockRow[]; isAll: boolean }) {
  const t = stockTotals(rows);
  return (
    <ReportTable
      caption="Stock at the event"
      columns={[
        {
          key: "p",
          header: "Product",
          rowHeader: true,
          cell: (s) => (
            <>
              <span className="block font-medium">{s.label}</span>
              <span className="text-muted-foreground text-xs">{s.sku}</span>
            </>
          ),
        },
        { key: "a", header: "Allocated", numeric: true, cell: (s) => s.allocated },
        { key: "s", header: "Sold", numeric: true, cell: (s) => s.sold },
        { key: "r", header: "Returned", numeric: true, cell: (s) => s.returned },
        { key: "d", header: "Damaged", numeric: true, cell: (s) => s.damaged },
        {
          key: "rem",
          header: isAll ? "Remaining" : "Closing",
          numeric: true,
          cell: (s) => s.remaining,
        },
      ]}
      rows={rows}
      rowKey={(s) => s.variantId}
      testId="stock-table"
      empty="No stock was allocated to this event."
      footer={["Total", t.allocated, t.sold, t.returned, t.damaged, t.remaining]}
    />
  );
}

function ExpenseTable({ report }: { report: ReturnType<typeof buildEventReport> }) {
  const s = report.summary;
  const rows = [
    ...report.expenses.map((e) => ({
      key: e.category,
      label: expenseCategoryLabels[e.category],
      count: e.count,
      amount: e.amountFils,
    })),
    { key: "fee", label: "Participation fee", count: 1, amount: s.feeFils ?? 0 },
  ];
  return (
    <ReportTable
      caption="Expenses by category"
      columns={[
        { key: "c", header: "Category", rowHeader: true, cell: (e) => e.label },
        { key: "n", header: "Entries", numeric: true, cell: (e) => e.count },
        { key: "a", header: "Amount", numeric: true, cell: (e) => formatAED(e.amount) },
      ]}
      rows={rows}
      rowKey={(e) => e.key}
      testId="expense-table"
      footer={["Total", "", formatAED((s.expensesFils ?? 0) + (s.feeFils ?? 0))]}
    />
  );
}
