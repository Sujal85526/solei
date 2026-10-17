import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { ConsentBadge } from "@/components/admin/customers/badges";
import { NewCustomerDialog } from "@/components/admin/customers/new-customer-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { CUSTOMERS_PAGE_SIZE, listCustomers } from "@/modules/customers/queries";
import {
  customerSources,
  emirateLabels,
  emirates,
  filtersToQuery,
  parseCustomerFilters,
  sortKeys,
  sortLabels,
  sourceLabels,
} from "@/modules/customers/schema";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const staff = await requirePagePermission("customers.view");
  const filters = parseCustomerFilters(await searchParams);
  const { rows, total, page } = await listCustomers(filters);
  const pages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));
  const showStats = can(staff.permissions, "orders.view");
  const filtered = Boolean(
    filters.q || filters.consent || filters.source || filters.emirate || filters.orders,
  );
  const exportQuery = filtersToQuery(filters, { page: 1 });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who bought, booked or signed up — across every channel."
        actions={
          <>
            <a
              href={`/admin/customers/export${exportQuery ? `?${exportQuery}` : ""}`}
              download
              className={buttonVariants({ variant: "outline" })}
            >
              <Download /> Export CSV
            </a>
            {can(staff.permissions, "customers.manage") ? <NewCustomerDialog /> : null}
          </>
        }
      />

      <form
        method="get"
        role="search"
        aria-label="Filter customers"
        className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1fr_9rem_9rem_9rem_9rem_10rem_auto]"
      >
        <Input
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Search name, phone or email"
          aria-label="Search customers"
          className="h-10 sm:col-span-2 lg:col-span-3 xl:col-span-1"
        />
        <NativeSelect
          name="consent"
          defaultValue={filters.consent ?? ""}
          aria-label="Marketing consent"
        >
          <option value="">Any consent</option>
          <option value="yes">Opted in</option>
          <option value="no">Not opted in</option>
        </NativeSelect>
        <NativeSelect name="source" defaultValue={filters.source ?? ""} aria-label="Source">
          <option value="">Any source</option>
          {customerSources.map((s) => (
            <option key={s} value={s}>
              {sourceLabels[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="emirate" defaultValue={filters.emirate ?? ""} aria-label="Emirate">
          <option value="">Any emirate</option>
          {emirates.map((e) => (
            <option key={e} value={e}>
              {emirateLabels[e]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="orders" defaultValue={filters.orders ?? ""} aria-label="Orders">
          <option value="">With or without orders</option>
          <option value="yes">Has orders</option>
          <option value="no">No orders yet</option>
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={filters.sort} aria-label="Sort by">
          {sortKeys.map((k) => (
            <option key={k} value={k}>
              Sort: {sortLabels[k]}
            </option>
          ))}
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Search
          </Button>
          {filtered ? (
            <Link href="/admin/customers" className={buttonVariants({ variant: "ghost" })}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <p className="text-muted-foreground mb-2 text-sm" aria-live="polite">
        {total === 1 ? "1 customer" : `${total.toLocaleString("en-AE")} customers`}
        {filtered ? " match" : ""}
      </p>

      {rows.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
          {filtered ? "No customers match these filters." : "No customers yet."}
        </p>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          <div
            aria-hidden
            className="text-muted-foreground hidden grid-cols-[1fr_5rem_8rem_8rem_8rem_1rem] gap-4 border-b px-5 py-2 text-xs font-medium tracking-wide uppercase md:grid"
          >
            <span>Customer</span>
            <span className="text-end">Orders</span>
            <span className="text-end">Total spent</span>
            <span>Last purchase</span>
            <span>Marketing</span>
            <span />
          </div>
          <ul className="divide-y" aria-label="Customers">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/customers/${c.id}`}
                  className="hover:bg-muted/60 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[1fr_5rem_8rem_8rem_8rem_1rem] md:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {c.name ?? c.email ?? "No name"}
                    </span>
                    <span className="text-muted-foreground block truncate text-sm">
                      {[c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="numeric text-muted-foreground md:text-foreground text-end text-sm">
                    {showStats ? (
                      <>
                        {c.order_count}
                        <span className="md:sr-only">
                          {" "}
                          {c.order_count === 1 ? "order" : "orders"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="numeric text-sm font-medium md:text-end">
                    <span className="sr-only">Total spent </span>
                    {showStats ? formatAED(c.total_spent_fils ?? 0) : "—"}
                  </span>
                  <span className="text-muted-foreground text-end text-sm md:text-start">
                    {c.last_purchase_at ? (
                      <>
                        <span className="md:sr-only">Last </span>
                        {formatBusinessDate(c.last_purchase_at)}
                      </>
                    ) : (
                      <span className="hidden md:inline">—</span>
                    )}
                  </span>
                  <span className="col-span-2 md:col-span-1">
                    <ConsentBadge customer={c} />
                  </span>
                  <ChevronRight className="text-muted-foreground hidden size-4 md:block rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={`?${filtersToQuery(filters, { page: page - 1 })}`}
            aria-disabled={page <= 1}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page <= 1 && "pointer-events-none opacity-50",
            )}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={`?${filtersToQuery(filters, { page: page + 1 })}`}
            aria-disabled={page >= pages}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page >= pages && "pointer-events-none opacity-50",
            )}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </>
  );
}
