import type { Metadata } from "next";
import Link from "next/link";
import { CartReminderSettingsForm } from "@/components/admin/carts/cart-reminder-settings";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  cartStats,
  getCartReminderSettings,
  listCarts,
  type CartFilter,
} from "@/modules/carts/queries";
import {
  CART_STATUS_LABELS,
  cartRowStatus,
  hoursText,
  type CartRowStatus,
} from "@/modules/carts/schema";

export const metadata: Metadata = { title: "Abandoned carts" };

const FILTERS: { key: CartFilter; label: string }[] = [
  { key: "open", label: "In bags now" },
  { key: "recovered", label: "Recovered" },
  { key: "all", label: "All" },
];

const BADGE: Record<CartRowStatus, "success" | "muted" | "warning" | "outline"> = {
  active: "outline",
  abandoned: "warning",
  reminded: "warning",
  recovered: "success",
  converted: "muted",
  emptied: "muted",
};

const when = (iso: string) =>
  formatBusinessDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function CartsPage({ searchParams }: PageProps<"/admin/carts">) {
  const staff = await requirePagePermission("customers.view");
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.show) ? (sp.show as CartFilter) : "open";
  const [carts, stats, settings] = await Promise.all([
    listCarts(filter),
    cartStats(),
    getCartReminderSettings(),
  ]);
  const manage = can(staff.permissions, "settings.manage");

  return (
    <>
      <PageHeader
        title="Abandoned carts"
        description={
          settings.enabled
            ? `Signed-in customers' bags. A reminder goes out after ${hoursText(settings.firstHours)}${settings.secondHours ? `, another after ${hoursText(settings.secondHours)}` : ""}.`
            : "Signed-in customers' bags. Reminders are switched off."
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Left in bags" value={stats.abandoned} hint="Idle past the first delay" />
        <StatCard label="Their value" value={formatAED(stats.abandonedFils)} />
        <StatCard label="Reminders · 30 days" value={stats.reminded} />
        <StatCard
          label="Recovered · 30 days"
          value={stats.recovered}
          hint={stats.recoveredFils ? `${formatAED(stats.recoveredFils)} in orders` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <nav aria-label="Show" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "open" ? "/admin/carts" : `/admin/carts?show=${f.key}`}
                aria-current={f.key === filter ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
                  f.key === filter ? "border-burgundy bg-burgundy text-pink" : "hover:bg-card",
                )}
              >
                {f.label}
              </Link>
            ))}
          </nav>

          {carts.length === 0 ? (
            <div className="bg-card rounded-xl border p-8 text-center">
              <p className="font-medium">Nothing here yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Bags appear when signed-in customers add something.
              </p>
            </div>
          ) : (
            <ul className="bg-card divide-y rounded-xl border">
              {carts.map((c) => {
                const status = cartRowStatus(c, settings.firstHours);
                return (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {c.customerId ? (
                          <Link
                            href={`/admin/customers/${c.customerId}`}
                            className="truncate font-medium underline-offset-4 hover:underline"
                          >
                            {c.name || c.email}
                          </Link>
                        ) : (
                          <span className="truncate font-medium">{c.name || c.email}</span>
                        )}
                        <span className="numeric text-sm">
                          {c.status === "converted" && c.order
                            ? formatAED(c.order.totalFils)
                            : formatAED(c.valueFils)}
                        </span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {[
                          c.name ? c.email : null,
                          c.status === "open"
                            ? `${c.itemCount} item${c.itemCount === 1 ? "" : "s"}`
                            : null,
                          `last change ${when(c.updatedAt)}`,
                          c.remindersSent
                            ? `${c.remindersSent} reminder${c.remindersSent === 1 ? "" : "s"}`
                            : null,
                          c.linkOpenedAt ? "opened the link" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {c.order ? (
                      <Link
                        href={`/admin/orders/${c.order.id}`}
                        className="text-muted-foreground hidden text-xs underline underline-offset-4 sm:inline"
                      >
                        {c.order.number}
                      </Link>
                    ) : null}
                    <Badge variant={BADGE[status]}>{CART_STATUS_LABELS[status]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {manage ? (
          <AdminSection
            title="Reminders"
            description="Timing and on/off. The email wording is in Settings → Notifications (Bag reminder)."
          >
            <CartReminderSettingsForm settings={settings} />
          </AdminSection>
        ) : null}
      </div>
    </>
  );
}
