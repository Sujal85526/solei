import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { formatEventDates } from "@/components/admin/events/event-card";
import { TypeLabel } from "@/components/admin/events/event-style";
import { PageHeader } from "@/components/admin/page-header";
import { BarList, type BarDatum } from "@/components/admin/reports/charts";
import { EventPicker } from "@/components/admin/reports/event-picker";
import { ExportButtons } from "@/components/admin/reports/report-parts";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { compareRow, formatBp, type CompareRow } from "@/modules/reports/aggregate";
import { MAX_COMPARE, MIN_COMPARE, parseCompareIds } from "@/modules/reports/params";
import { eventReportFacts, reportEventOptions } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Compare events" };

type Metric = {
  key: string;
  label: string;
  value: (r: CompareRow) => ReactNode;
  /** Numeric value used to mark the best event in the row. */
  score?: (r: CompareRow) => number | null;
  financial?: boolean;
  strong?: boolean;
};

const METRICS: Metric[] = [
  {
    key: "dates",
    label: "Dates",
    value: (r) => `${formatEventDates(r.startDate, r.endDate)} ${r.startDate.slice(0, 4)}`,
  },
  { key: "days", label: "Days", value: (r) => r.days },
  {
    key: "revenue",
    label: "Revenue",
    value: (r) => formatAED(r.revenueFils),
    score: (r) => r.revenueFils,
    strong: true,
  },
  {
    key: "rpd",
    label: "Revenue / day",
    value: (r) => formatAED(r.revenuePerDayFils),
    score: (r) => r.revenuePerDayFils,
  },
  { key: "orders", label: "Orders", value: (r) => r.orders, score: (r) => r.orders },
  { key: "units", label: "Units", value: (r) => r.units, score: (r) => r.units },
  {
    key: "upd",
    label: "Units / day",
    value: (r) => r.unitsPerDay.toLocaleString("en-AE"),
    score: (r) => r.unitsPerDay,
  },
  {
    key: "cogs",
    label: "COGS",
    value: (r) => formatAED(r.cogsFils ?? 0),
    financial: true,
  },
  {
    key: "costs",
    label: "Expenses + fee",
    value: (r) => formatAED(r.eventCostsFils ?? 0),
    financial: true,
  },
  {
    key: "gp",
    label: "Gross profit",
    value: (r) => formatAED(r.grossProfitFils ?? 0),
    score: (r) => r.grossProfitFils,
    financial: true,
  },
  {
    key: "np",
    label: "Net profit",
    value: (r) => (
      <span className={cn((r.netProfitFils ?? 0) < 0 && "text-destructive")}>
        {formatAED(r.netProfitFils ?? 0)}
      </span>
    ),
    score: (r) => r.netProfitFils,
    financial: true,
    strong: true,
  },
  {
    key: "gm",
    label: "Gross margin",
    value: (r) => formatBp(r.grossMarginBp),
    score: (r) => r.grossMarginBp,
    financial: true,
  },
  {
    key: "nm",
    label: "Net margin",
    value: (r) => formatBp(r.netMarginBp),
    score: (r) => r.netMarginBp,
    financial: true,
  },
];

const short = (name: string, max = 22) => (name.length > max ? `${name.slice(0, max - 1)}…` : name);

export default async function CompareEventsPage({
  searchParams,
}: PageProps<"/admin/reports/events/compare">) {
  await requirePagePermission("reports.view");
  const ids = parseCompareIds((await searchParams).ids);
  const [options, facts] = await Promise.all([
    reportEventOptions(),
    ids.length >= MIN_COMPARE ? eventReportFacts(ids) : Promise.resolve([]),
  ]);
  const rows = facts.map(compareRow);
  const financial = facts.length > 0 && facts.every((f) => f.financial);
  const metrics = METRICS.filter((m) => !m.financial || financial);
  const ready = rows.length >= MIN_COMPARE;

  const chart = (pick: (r: CompareRow) => number): BarDatum[] =>
    rows.map((r, i) => ({ label: `${i + 1}. ${short(r.name)}`, value: pick(r), note: r.name }));

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link
        href="/admin/reports"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Reports
      </Link>
      <PageHeader
        title="Compare events"
        description={
          ready
            ? `${rows.length} events side by side. Revenue after refunds, incl. VAT; per day uses the scheduled days.`
            : `Choose ${MIN_COMPARE}–${MAX_COMPARE} events.`
        }
        actions={
          ready ? (
            <ExportButtons
              href={`/admin/reports/events/compare/export?ids=${rows.map((r) => r.id).join(",")}`}
            />
          ) : null
        }
      />

      {ready ? (
        <>
          <AdminSection title="Side by side">
            <div
              className="-mx-5 overflow-x-auto sm:mx-0 sm:rounded-lg sm:border"
              data-testid="compare-table"
            >
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Event comparison</caption>
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th
                      scope="col"
                      className="bg-muted sticky start-0 z-10 px-3 py-2 ps-5 text-start font-medium sm:bg-transparent sm:ps-3"
                    >
                      <span className="sr-only">Measure</span>
                    </th>
                    {rows.map((r, i) => (
                      <th
                        key={r.id}
                        scope="col"
                        className="max-w-56 px-3 py-2 text-end align-bottom font-medium"
                      >
                        <Link
                          href={`/admin/reports/events/${r.id}`}
                          className="text-burgundy block text-sm whitespace-normal underline-offset-4 hover:underline"
                        >
                          <span className="text-muted-foreground me-1 text-xs">{i + 1}.</span>
                          {r.name}
                        </Link>
                        <TypeLabel
                          type={r.type}
                          className="text-muted-foreground mt-0.5 justify-end text-xs"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metrics.map((m) => {
                    const scores = m.score ? rows.map((r) => m.score!(r)) : [];
                    const valid = scores.filter((v): v is number => v !== null);
                    const best = valid.length > 1 ? Math.max(...valid) : null;
                    return (
                      <tr key={m.key} data-metric={m.key}>
                        <th
                          scope="row"
                          className="bg-card text-muted-foreground sticky start-0 z-10 px-3 py-2.5 ps-5 text-start text-xs font-medium sm:ps-3"
                        >
                          {m.label}
                        </th>
                        {rows.map((r, i) => {
                          const isBest =
                            best !== null && scores[i] === best && valid.some((v) => v !== best);
                          return (
                            <td
                              key={r.id}
                              className={cn(
                                "numeric relative px-3 py-2.5 text-end whitespace-nowrap",
                                m.strong && "font-semibold",
                                isBest && "bg-pink-wash",
                              )}
                            >
                              {m.value(r)}
                              {isBest ? <span className="sr-only"> (best)</span> : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              <span
                className="bg-pink-wash me-1.5 inline-block size-3 rounded-sm align-middle"
                aria-hidden
              />
              Best in the row.
            </p>
          </AdminSection>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AdminSection title="Revenue">
              <BarList
                label="Revenue by event"
                format="aed"
                labelWidth={150}
                data={chart((r) => r.revenueFils)}
              />
            </AdminSection>
            <AdminSection title="Revenue per day">
              <BarList
                label="Revenue per day by event"
                format="aed"
                labelWidth={150}
                data={chart((r) => r.revenuePerDayFils)}
              />
            </AdminSection>
            <AdminSection title="Units sold">
              <BarList
                label="Units by event"
                format="int"
                labelWidth={150}
                data={chart((r) => r.units)}
              />
            </AdminSection>
            {financial ? (
              <AdminSection
                title="Net profit"
                description="After COGS, expenses and the participation fee."
              >
                <BarList
                  label="Net profit by event"
                  format="aed"
                  labelWidth={150}
                  data={chart((r) => r.netProfitFils ?? 0)}
                />
              </AdminSection>
            ) : (
              <AdminSection title="Units per day">
                <BarList
                  label="Units per day by event"
                  format="dec"
                  labelWidth={150}
                  data={chart((r) => r.unitsPerDay)}
                />
              </AdminSection>
            )}
          </div>
        </>
      ) : ids.length ? (
        <p className="text-muted-foreground text-sm" role="status">
          Pick at least {MIN_COMPARE} events to compare.
        </p>
      ) : null}

      <AdminSection title={ready ? "Change events" : "Events"}>
        <EventPicker
          options={options}
          selected={ids}
          submitLabel={ready ? "Update comparison" : "Compare selected"}
        />
      </AdminSection>
    </div>
  );
}
