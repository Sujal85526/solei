import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MonitorSmartphone, Plus } from "lucide-react";
import { ExportsPanel } from "@/components/admin/dashboard/exports-panel";
import { StatusBadge } from "@/components/admin/events/event-style";
import { PageHeader } from "@/components/admin/page-header";
import { BarList } from "@/components/admin/reports/charts";
import { Kpi } from "@/components/admin/reports/report-parts";
import { AdminSection } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { changeBp, formatChange, startsIn } from "@/modules/dashboard/logic";
import { dashboardSummary } from "@/modules/dashboard/queries";
import type { PeriodFigures, PeriodKey } from "@/modules/dashboard/types";
import { EXPORT_KINDS, EXPORT_PERMISSION } from "@/modules/exports/params";
import { CHANNEL_LABELS } from "@/modules/orders/status";

export const metadata: Metadata = { title: "Dashboard" };

const PERIODS: { key: PeriodKey; label: string; vs: string }[] = [
  { key: "today", label: "Today", vs: "yesterday" },
  { key: "week", label: "This week", vs: "same days last week" },
  { key: "month", label: "This month", vs: "same days last month" },
];

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-AE")} ${n === 1 ? one : many}`;

function vsHint(cur: number, prev: number, vs: string) {
  const bp = changeBp(cur, prev);
  return bp === null ? null : `${formatChange(bp)} vs ${vs}`;
}

function periodKpi(p: PeriodFigures, label: string, vs: string, money: boolean, brand: boolean) {
  if (money && p.revenue_fils !== null) {
    const change = vsHint(p.revenue_fils, p.prev_revenue_fils ?? 0, vs);
    return (
      <Kpi
        key={label}
        label={`${label} · revenue`}
        value={formatAED(p.revenue_fils)}
        hint={[plural(p.orders, "order"), change].filter(Boolean).join(" · ")}
        tone={brand ? "brand" : undefined}
        testId={`kpi-${label}`}
      />
    );
  }
  return (
    <Kpi
      key={label}
      label={`${label} · orders`}
      value={p.orders.toLocaleString("en-AE")}
      hint={vsHint(p.orders, p.prev_orders, vs)}
      tone={brand ? "brand" : undefined}
      testId={`kpi-${label}`}
    />
  );
}

const linkCls = "text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline";

export default async function AdminDashboard() {
  const staff = await requirePagePermission("dashboard.view");
  const d = await dashboardSummary();
  const perms = staff.permissions;
  const firstName = staff.name.split(" ")[0] || staff.name;
  const exportKinds = EXPORT_KINDS.filter((k) => can(perms, EXPORT_PERMISSION[k]));
  const handle = d.to_handle.new + d.to_handle.preparing + d.to_handle.dispatched;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description={formatBusinessDate(d.today, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <>
            {can(perms, "pos.use") ? (
              <Link href="/admin/pos" className={buttonVariants()}>
                <MonitorSmartphone /> Open POS
              </Link>
            ) : null}
            {can(perms, "orders.create") ? (
              <Link href="/admin/orders/new" className={buttonVariants({ variant: "outline" })}>
                <Plus /> New order
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PERIODS.map((p, i) => periodKpi(d.periods[p.key], p.label, p.vs, d.money, i === 0))}
        {d.outstanding ? (
          <Link href="/admin/orders/outstanding" className="rounded-xl">
            <Kpi
              label="Outstanding"
              value={formatAED(d.outstanding.total_fils)}
              hint={`${plural(d.outstanding.orders, "order")} awaiting payment`}
              testId="kpi-outstanding"
            />
          </Link>
        ) : (
          <Kpi label="To handle" value={handle} hint="new, preparing or dispatched" />
        )}
      </div>

      {d.money ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminSection title="Revenue by channel" description="This month, before refunds.">
            {d.by_channel?.length ? (
              <BarList
                label="Revenue by channel this month"
                format="aed"
                data={d.by_channel.map((c) => ({
                  label: CHANNEL_LABELS[c.channel],
                  value: c.revenue_fils,
                  note: plural(c.orders, "order"),
                }))}
              />
            ) : (
              <p className="text-muted-foreground text-sm">No sales yet this month.</p>
            )}
          </AdminSection>
          <TopProducts d={d} money />
        </div>
      ) : (
        <TopProducts d={d} money={false} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {can(perms, "orders.view") ? (
          <AdminSection
            title="Orders to handle"
            actions={
              <Link href="/admin/orders" className={linkCls}>
                All orders <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            <ul className="divide-y text-sm">
              {(["new", "preparing", "dispatched"] as const).map((s) => (
                <li key={s}>
                  <Link
                    href={`/admin/orders?status=${s}`}
                    className="hover:bg-muted/50 -mx-2 flex items-center justify-between rounded-md px-2 py-2.5"
                  >
                    <span className="capitalize">{s}</span>
                    <span className="numeric font-semibold">{d.to_handle[s]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminSection>
        ) : null}

        {d.low_stock ? (
          <AdminSection
            title="Low stock"
            description="Warehouse units at or below the alert level."
            actions={
              <Link href="/admin/inventory/low-stock" className={linkCls}>
                Inventory <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            {d.low_stock.length ? (
              <ul className="divide-y text-sm" data-testid="low-stock">
                {d.low_stock.map((s) => (
                  <li key={s.sku} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      {s.product} <span className="text-muted-foreground">{s.variant}</span>
                    </span>
                    <span
                      className={
                        s.on_hand <= 0 ? "text-destructive numeric font-semibold" : "numeric"
                      }
                    >
                      {s.on_hand} left
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Everything is above its alert level.</p>
            )}
          </AdminSection>
        ) : null}

        {d.upcoming_events ? (
          <AdminSection
            title="Upcoming events"
            description="Next 45 days."
            actions={
              <Link href="/admin/calendar" className={linkCls}>
                Calendar <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            {d.upcoming_events.length ? (
              <ul className="divide-y text-sm">
                {d.upcoming_events.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/admin/calendar/events/${e.id}`}
                      className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{e.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {formatBusinessDate(e.start_date, { day: "numeric", month: "short" })}
                          {e.end_date !== e.start_date
                            ? ` – ${formatBusinessDate(e.end_date, { day: "numeric", month: "short" })}`
                            : ""}
                          {e.location ? ` · ${e.location}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={e.status} />
                        <span className="text-muted-foreground text-xs">
                          {startsIn(d.today, e.start_date, e.end_date)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing booked in the next 45 days.</p>
            )}
          </AdminSection>
        ) : null}

        {d.pending_bookings ? (
          <AdminSection
            title="Booking requests"
            description={`${plural(d.pending_bookings.count, "request")} waiting for a reply.`}
            actions={
              <Link href="/admin/bookings" className={linkCls}>
                Bookings <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            {d.pending_bookings.items.length ? (
              <ul className="divide-y text-sm">
                {d.pending_bookings.items.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5"
                    >
                      <span>
                        <span className="font-medium">{b.name}</span>{" "}
                        <span className="text-muted-foreground">{b.ref}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        for {formatBusinessDate(b.event_date, { day: "numeric", month: "short" })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">All caught up.</p>
            )}
          </AdminSection>
        ) : null}
      </div>

      {exportKinds.length ? (
        <AdminSection
          title="Exports"
          description="Excel (with totals) or CSV. Dates are Asia/Dubai."
          className="lg:max-w-xl"
        >
          <ExportsPanel kinds={exportKinds} from={d.month_start} to={d.today} />
        </AdminSection>
      ) : null}
    </div>
  );
}

function TopProducts({
  d,
  money,
}: {
  d: Awaited<ReturnType<typeof dashboardSummary>>;
  money: boolean;
}) {
  return (
    <AdminSection title="Top products" description="This month, by units sold.">
      {d.top_products.length ? (
        <ol className="divide-y text-sm">
          {d.top_products.map((p, i) => (
            <li key={p.product} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-3">
                <span className="text-muted-foreground numeric w-4 text-end">{i + 1}</span>
                {p.product}
              </span>
              <span className="numeric text-end">
                {plural(p.units, "unit")}
                {money && p.revenue_fils !== null ? (
                  <span className="text-muted-foreground ms-2">{formatAED(p.revenue_fils)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No sales yet this month.</p>
      )}
    </AdminSection>
  );
}
