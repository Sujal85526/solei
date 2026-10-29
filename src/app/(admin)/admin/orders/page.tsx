import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { OrdersList } from "@/components/admin/orders/orders-list";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination, queryString } from "@/components/admin/pagination";
import { StatCard } from "@/components/admin/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import {
  ORDERS_PAGE_SIZE,
  eventOptions,
  listOrders,
  orderStats,
  staffOptions,
} from "@/modules/orders/queries";
import { orderFiltersSchema } from "@/modules/orders/schema";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/modules/orders/status";

export const metadata: Metadata = { title: "Orders" };

const first = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const staff = await requirePagePermission("orders.view");
  const sp = await searchParams;
  const filters = orderFiltersSchema.parse(
    Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, first(v)])),
  );
  const [{ rows, total, page }, stats, events, sellers] = await Promise.all([
    listOrders(filters),
    orderStats(),
    eventOptions(),
    staffOptions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const filtered = Object.entries(filters).some(([k, v]) => k !== "page" && v);

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every sale from every channel. Times in Abu Dhabi."
        actions={
          <>
            <Link
              href="/admin/orders/outstanding"
              className={buttonVariants({ variant: "outline" })}
            >
              Outstanding
            </Link>
            {can(staff.permissions, "orders.create") ? (
              <Link href="/admin/orders/new" className={buttonVariants()}>
                <Plus /> New order
              </Link>
            ) : null}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today's orders"
          value={stats.todayCount}
          hint={formatAED(stats.todayRevenueFils)}
        />
        <StatCard
          label="Outstanding"
          value={formatAED(stats.outstandingFils)}
          hint={`${stats.outstandingCount} ${stats.outstandingCount === 1 ? "order" : "orders"} with a balance`}
          tone={stats.outstandingFils > 0 ? "warn" : undefined}
        />
      </div>

      <form
        method="get"
        role="search"
        aria-label="Filter orders"
        className="bg-card mb-5 grid grid-cols-2 gap-2 rounded-xl border p-3 sm:p-4 lg:grid-cols-6"
      >
        <div className="relative col-span-2 lg:col-span-2">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Order no., name or phone"
            aria-label="Search orders"
            className="h-10 ps-9"
          />
        </div>
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Open & closed</option>
          <option value="all">All, incl. awaiting payment</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="payment" defaultValue={filters.payment ?? ""} aria-label="Payment">
          <option value="">Any payment</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="channel" defaultValue={filters.channel ?? ""} aria-label="Channel">
          <option value="">All channels</option>
          {Object.entries(CHANNEL_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="event" defaultValue={filters.event ?? ""} aria-label="Event">
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="staff" defaultValue={filters.staff ?? ""} aria-label="Made by">
          <option value="">Made by anyone</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <Input
          type="date"
          name="from"
          defaultValue={filters.from}
          aria-label="From date"
          className="h-10"
        />
        <Input
          type="date"
          name="to"
          defaultValue={filters.to}
          aria-label="To date"
          className="h-10"
        />
        <div className="col-span-2 flex gap-2 lg:col-span-2">
          <Button type="submit" className="h-10 flex-1">
            Filter
          </Button>
          {filtered ? (
            <Link
              href="/admin/orders"
              className={buttonVariants({ variant: "ghost", className: "h-10" })}
            >
              Reset
            </Link>
          ) : null}
        </div>
      </form>

      <p className="text-muted-foreground mb-3 text-sm" aria-live="polite">
        {total.toLocaleString("en-AE")} {total === 1 ? "order" : "orders"}
      </p>
      <OrdersList rows={rows} />
      <Pagination
        page={page}
        pages={pages}
        href={(p) => `?${queryString({ ...filters, page: p })}`}
      />
    </>
  );
}
