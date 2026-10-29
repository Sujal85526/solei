import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { hoursText } from "@/modules/attendance/schema";
import { staffPerformance } from "@/modules/staff-report/queries";
import {
  hoursDifference,
  reportRange,
  salesPerHourFils,
  staffTotals,
} from "@/modules/staff-report/report";

export const metadata: Metadata = { title: "Staff report" };

const hrs = (m: number | null) => (m === null ? "—" : hoursText(m));

/**
 * Per person for a period: sales they made, hours clocked against the rota, shifts and events
 * worked. Hours need staff.manage (as on the attendance page); sales need reports.view.
 */
export default async function StaffReportPage({ searchParams }: PageProps<"/admin/reports/staff">) {
  const staff = await requirePagePermission("reports.view");
  const sp = await searchParams;
  const { from, to } = reportRange(sp.from, sp.to);
  const rows = await staffPerformance(from, to);
  const withHours = can(staff.permissions, "staff.manage");
  const canOrders = can(staff.permissions, "orders.view");
  const totals = staffTotals(rows);
  const range = `from=${from}&to=${to}`;

  return (
    <>
      <PageHeader
        title="Staff report"
        description={`${formatBusinessDate(from)} – ${formatBusinessDate(to)}. Sales are the orders each person made at the till or by hand, after refunds.`}
        actions={
          <a
            href={`/admin/reports/staff/export?${range}`}
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <Download /> Excel
          </a>
        }
      />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" aria-label="Period">
        <label className="flex flex-col gap-1.5 text-sm">
          From
          <Input type="date" name="from" defaultValue={from} className="h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          To
          <Input type="date" name="to" defaultValue={to} className="h-10 w-40" />
        </label>
        <Button type="submit" variant="outline" className="h-10">
          Show
        </Button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales by staff" value={formatAED(totals.salesFils)} />
        <StatCard label="Orders" value={totals.orders} hint={`${totals.units} units`} />
        {withHours ? (
          <>
            <StatCard
              label="Hours worked"
              value={hrs(totals.workedMinutes)}
              hint={`${totals.shiftsWorked ?? 0} shifts`}
            />
            <StatCard
              label="Hours planned"
              value={hrs(totals.plannedMinutes)}
              hint={`${totals.plannedShifts ?? 0} shifts on the rota`}
            />
          </>
        ) : null}
      </div>

      <AdminSection title="Per person">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No staff yet.</p>
        ) : (
          <ul className="-mx-5 divide-y text-sm sm:-mx-6" aria-label="Staff">
            {rows.map((r) => {
              const diff = hoursDifference(r);
              const perHour = salesPerHourFils(r);
              return (
                <li key={r.userId} className="grid gap-2 px-5 py-3 sm:px-6 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {r.name}
                      {r.active ? null : <Badge variant="muted">Former</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        r.jobTitle,
                        `${r.eventsWorked} ${r.eventsWorked === 1 ? "event" : "events"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4 md:text-end">
                    <div>
                      <dt className="text-muted-foreground text-xs">Sales</dt>
                      <dd className="numeric font-medium">
                        {canOrders && r.orders ? (
                          <Link
                            href={`/admin/orders?staff=${r.userId}&${range}&status=all`}
                            className="underline-offset-4 hover:underline"
                          >
                            {formatAED(r.salesFils)}
                          </Link>
                        ) : (
                          formatAED(r.salesFils)
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs">Orders · units</dt>
                      <dd className="numeric">
                        {r.orders} · {r.units}
                      </dd>
                    </div>
                    {withHours ? (
                      <>
                        <div>
                          <dt className="text-muted-foreground text-xs">Worked / planned</dt>
                          <dd className="numeric">
                            {hrs(r.workedMinutes)} / {hrs(r.plannedMinutes)}
                            {diff !== null && diff !== 0 ? (
                              <span
                                className={
                                  diff < 0 ? "text-destructive block text-xs" : "block text-xs"
                                }
                              >
                                {diff > 0 ? "+" : "−"}
                                {hoursText(Math.abs(diff))}
                              </span>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground text-xs">Sales per hour</dt>
                          <dd className="numeric">{perHour === null ? "—" : formatAED(perHour)}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </AdminSection>
    </>
  );
}
