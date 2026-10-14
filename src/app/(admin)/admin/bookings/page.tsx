import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import {
  BOOKING_STATUS_LABELS,
  BookingStatusBadge,
} from "@/components/admin/bookings/booking-badges";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav } from "@/components/admin/sub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventsCopy } from "@/content/events";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { BOOKING_STATUSES, bookingStatusCounts, listBookings } from "@/modules/bookings/queries";
import type { BookingStatus } from "@/modules/bookings/types";

export const metadata: Metadata = { title: "Bookings" };

const first = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const staff = await requirePagePermission("bookings.view");
  const sp = await searchParams;
  const raw = first(sp.status);
  const status: BookingStatus | "open" | undefined =
    raw === "all"
      ? undefined
      : raw && (BOOKING_STATUSES as string[]).includes(raw)
        ? (raw as BookingStatus)
        : raw === undefined
          ? "open"
          : undefined;
  const q = first(sp.q);
  const [rows, counts] = await Promise.all([listBookings({ status, q }), bookingStatusCounts()]);
  const open = counts.requested + counts.in_review;
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "open", label: "To review", count: open },
    ...BOOKING_STATUSES.filter((s) => s !== "requested" && s !== "in_review").map((s) => ({
      key: s,
      label: BOOKING_STATUS_LABELS[s],
      count: counts[s],
    })),
    { key: "all", label: "All", count: all },
  ];
  const current = raw ?? "open";
  const href = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "open") p.set("status", key);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/bookings?${s}` : "/admin/bookings";
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Event requests from the website — review, quote, confirm."
      />
      {can(staff.permissions, "bookings.manage") ? (
        <SubNav
          items={[
            { href: "/admin/bookings", label: "Inbox" },
            { href: "/admin/bookings/settings", label: "Packages & options" },
          ]}
        />
      ) : null}

      <nav aria-label="Booking status" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={href(t.key)}
                aria-current={current === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                  current === t.key
                    ? "bg-burgundy border-burgundy text-cream"
                    : "bg-card hover:border-burgundy/40",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "numeric rounded-full px-1.5 text-xs",
                    current === t.key ? "bg-cream/20" : "bg-muted",
                  )}
                >
                  {t.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form method="get" role="search" aria-label="Search bookings" className="mb-5 flex gap-2">
        {raw ? <input type="hidden" name="status" value={raw} /> : null}
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Ref, name, phone or email"
            aria-label="Search bookings"
            className="h-10 ps-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {rows.length ? (
        <ul className="bg-card divide-y rounded-xl border">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="hover:bg-muted/50 flex items-center gap-4 p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="numeric font-medium">{b.ref}</span>
                    <BookingStatusBadge status={b.status} />
                  </p>
                  <p className="mt-1 truncate text-sm">
                    {b.contact_name} · {b.booking_event_types?.name ?? "Event"} ·{" "}
                    {formatBusinessDate(b.event_date, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {b.guests} guests · {b.location}, {eventsCopy.emirates[b.emirate]} · received{" "}
                    {formatBusinessDate(b.created_at, { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="numeric hidden text-end text-sm sm:block">
                  <p className="text-muted-foreground text-xs">Estimate</p>
                  {formatAED(b.estimated_total_fils)}
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">
          {q ? "No bookings match your search." : "No bookings here yet."}
        </p>
      )}
    </>
  );
}
