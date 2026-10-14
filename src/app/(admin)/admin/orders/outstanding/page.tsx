import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ReminderButton } from "@/components/admin/orders/reminder-button";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { outstandingByCustomer } from "@/modules/orders/manual-queries";
import { CHANNEL_LABELS, type OrderChannel } from "@/modules/orders/status";

export const metadata: Metadata = { title: "Outstanding payments" };

export default async function OutstandingPage() {
  const staff = await requirePagePermission("orders.view");
  const customers = await outstandingByCustomer();
  const total = customers.reduce((s, c) => s + c.totalOutstandingFils, 0);
  const overdue = customers.filter((c) => c.oldestDays > 7).length;
  const canRemind = can(staff.permissions, "payment_links.create");

  return (
    <>
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Orders
      </Link>
      <PageHeader title="Outstanding" description="Customers with unpaid balances, oldest first." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total outstanding" value={formatAED(total)} />
        <StatCard label="Customers" value={customers.length} />
        <StatCard label="Over 7 days" value={overdue} tone={overdue ? "warn" : undefined} />
      </div>
      {customers.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">
          Everyone is paid up.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {customers.map((c) => (
            <li
              key={c.customerId ?? c.orders[0].id}
              className="bg-card rounded-xl border p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {c.customerId ? (
                      <Link href={`/admin/customers/${c.customerId}`} className="hover:underline">
                        {c.name}
                      </Link>
                    ) : (
                      c.name
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {[c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-end">
                  <p className="numeric text-xl font-semibold">
                    {formatAED(c.totalOutstandingFils)}
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      c.oldestDays > 7 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    oldest{" "}
                    {c.oldestDays === 0
                      ? "today"
                      : `${c.oldestDays} day${c.oldestDays === 1 ? "" : "s"} ago`}
                  </p>
                </div>
              </div>
              <ul className="mt-4 divide-y border-t">
                {c.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.number}
                    </Link>
                    <Badge variant="muted">
                      {CHANNEL_LABELS[o.channel as OrderChannel] ?? o.channel}
                    </Badge>
                    <span className="numeric text-muted-foreground">
                      {formatAED(o.outstandingFils)} of {formatAED(o.totalFils)}
                    </span>
                    {canRemind ? (
                      <span className="ms-auto">
                        <ReminderButton orderId={o.id} />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
