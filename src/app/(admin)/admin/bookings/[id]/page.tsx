import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, MessageCircle } from "lucide-react";
import { BookingStatusBadge, QuoteStatusBadge } from "@/components/admin/bookings/booking-badges";
import { BookingStatusActions } from "@/components/admin/bookings/booking-actions";
import { BookingMessages } from "@/components/admin/bookings/booking-messages";
import { PaymentLinks } from "@/components/admin/bookings/payment-links";
import { QuoteBuilder, ShareButtons } from "@/components/admin/bookings/quote-builder";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/order-badges";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { eventsCopy } from "@/content/events";
import { publicEnv } from "@/lib/env";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { estimateToQuoteLines } from "@/modules/bookings/estimate";
import {
  bookingOrders,
  getBooking,
  getBookingSettings,
  storedEstimate,
} from "@/modules/bookings/queries";
import { waLink, waTexts } from "@/modules/bookings/whatsapp";

export const metadata: Metadata = { title: "Booking" };

const QUOTABLE = ["requested", "in_review", "quoted", "accepted"];

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function BookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const staff = await requirePagePermission("bookings.view");
  const { id } = await params;
  const [booking, orders, settings] = await Promise.all([
    getBooking(id),
    bookingOrders(id),
    getBookingSettings(),
  ]);
  if (!booking) notFound();
  const canManage = can(staff.permissions, "bookings.manage");
  const quoteUrl = (token: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/events/quote/${token}`;

  const latest = booking.quotes.find((q) => q.status === "sent" || q.status === "accepted");
  const paidFils = orders
    .filter((o) => o.channel === "booking")
    .reduce((s, o) => s + o.paidFils - o.refundedFils, 0);
  const estimate = storedEstimate(booking);
  const today = businessDay();
  const products = booking.products_interest
    .map((p) => `${p.category.replaceAll("_", " ")} × ${p.qty}`)
    .join(", ");

  // Services and products of interest are no longer asked (P2-57): shown only on older
  // bookings that have them.
  const services = booking.services.map((s) => s.name).join(", ");
  const details: [string, React.ReactNode][] = [
    ["Occasion", booking.booking_event_types?.name ?? "—"],
    [
      "Date",
      `${formatBusinessDate(booking.event_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`,
    ],
    ["Venue", `${booking.location}, ${eventsCopy.emirates[booking.emirate]}`],
    ["Guests", booking.guests],
    ...(services ? [["Services", services] as [string, React.ReactNode]] : []),
    ["Package", booking.booking_packages?.name ?? "Not sure yet"],
    ["Booth", booking.booth_designs?.name ?? "No preference"],
    [
      "Flowers",
      booking.flowers && booking.flower_options ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded-full border"
            style={{ backgroundColor: booking.flower_options.hex }}
          />
          {booking.flower_options.name}
        </span>
      ) : (
        "None"
      ),
    ],
    ...(products ? [["Products", products] as [string, React.ReactNode]] : []),
    ["Special requests", booking.special_requests ?? "—"],
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link
        href="/admin/bookings"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Bookings
      </Link>
      <PageHeader
        title={`${booking.ref} · ${booking.contact_name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <span>
              Received{" "}
              {formatBusinessDate(booking.created_at, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </span>
        }
        actions={
          canManage ? <BookingStatusActions bookingId={booking.id} status={booking.status} /> : null
        }
      />

      {booking.reject_reason && ["rejected", "cancelled"].includes(booking.status) ? (
        <p className="bg-destructive/5 border-destructive/30 rounded-lg border p-4 text-sm">
          Reason: {booking.reject_reason}
        </p>
      ) : null}

      {booking.event_id ? (
        <Link
          href={`/admin/calendar/events/${booking.event_id}`}
          className="bg-success/5 border-success/30 flex items-center gap-3 rounded-lg border p-4 text-sm"
        >
          <CalendarCheck className="text-success size-5" />
          On the calendar as a private event — open it
        </Link>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <AdminSection title="Request" className="lg:col-span-3">
          <dl className="divide-y text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-lg border p-4 text-sm">
            <p className="font-medium">Estimate shown to the customer</p>
            <ul className="mt-2 flex flex-col gap-1">
              {estimate.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {l.label}
                    {l.kind === "products" ? ` × ${l.qty}` : ""}
                  </span>
                  <span className="numeric">
                    {l.totalFils === null ? "to quote" : formatAED(l.totalFils)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="numeric mt-2 flex justify-between border-t pt-2 font-medium">
              <span>Total</span>
              {formatAED(booking.estimated_total_fils)}
            </p>
          </div>
        </AdminSection>

        <AdminSection title="Customer" className="lg:col-span-2">
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Name</dt>
              <dd>{booking.contact_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Phone</dt>
              <dd>
                <a href={`tel:${booking.contact_phone}`} className="underline underline-offset-4">
                  {formatPhone(booking.contact_phone)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Email</dt>
              <dd>
                <a
                  href={`mailto:${booking.contact_email}`}
                  className="break-all underline underline-offset-4"
                >
                  {booking.contact_email}
                </a>
              </dd>
            </div>
          </dl>
          {booking.customer_id && can(staff.permissions, "customers.view") ? (
            <Link
              href={`/admin/customers/${booking.customer_id}`}
              className={buttonVariants({ variant: "outline", size: "sm", className: "me-2 mt-4" })}
            >
              Customer profile
            </Link>
          ) : null}
          <a
            href={waLink(
              booking.contact_phone,
              waTexts.greeting(booking.contact_name, booking.ref),
            )}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4" })}
          >
            <MessageCircle /> WhatsApp (not logged)
          </a>
        </AdminSection>
      </div>

      <AdminSection
        title="Quotation"
        description={
          latest
            ? `Current: v${latest.version} · ${formatAED(latest.total_fils)} · deposit ${formatAED(latest.deposit_fils)}`
            : "Build the quote from the request. Each send creates a new version with its own accept link."
        }
      >
        {canManage && QUOTABLE.includes(booking.status) ? (
          <QuoteBuilder
            key={latest?.id ?? "new"}
            bookingId={booking.id}
            bookingRef={booking.ref}
            customerName={booking.contact_name}
            customerPhone={booking.contact_phone}
            initialLines={
              latest
                ? latest.lines.map((l) => ({
                    label: l.label,
                    qty: l.qty,
                    unitPriceFils: l.unitPriceFils,
                  }))
                : estimateToQuoteLines(estimate)
            }
            depositBp={settings.booking_deposit_bp}
            defaultValidUntil={addDays(today, settings.booking_quote_validity_days)}
            minDate={today}
          />
        ) : null}

        {booking.quotes.length ? (
          <ul className="mt-6 divide-y rounded-lg border">
            {booking.quotes.map((q) => (
              <li key={q.id} className="p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">v{q.version}</span>
                  <QuoteStatusBadge status={q.status} />
                  <span className="numeric">{formatAED(q.total_fils)}</span>
                  <span className="text-muted-foreground">
                    deposit {formatAED(q.deposit_fils)} · valid until{" "}
                    {formatBusinessDate(q.valid_until)} · sent{" "}
                    {formatBusinessDate(q.sent_at, { day: "numeric", month: "short" })}
                    {q.accepted_at
                      ? ` · accepted ${formatBusinessDate(q.accepted_at, { day: "numeric", month: "short" })}`
                      : ""}
                  </span>
                </p>
                {q.status === "sent" || q.status === "accepted" ? (
                  <>
                    <p
                      className="text-muted-foreground mt-2 text-xs break-all"
                      data-testid="current-quote-link"
                    >
                      {quoteUrl(q.token)}
                    </p>
                    <ShareButtons
                      link={quoteUrl(q.token)}
                      whatsapp={waLink(
                        booking.contact_phone,
                        waTexts.quote(
                          booking.contact_name,
                          booking.ref,
                          q.total_fils,
                          quoteUrl(q.token),
                        ),
                      )}
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </AdminSection>

      <AdminSection
        title="Payments"
        description={
          latest
            ? `Paid ${formatAED(paidFils)} of ${formatAED(latest.total_fils)}. Paying the deposit confirms the booking.`
            : "Send a quotation first."
        }
      >
        {canManage && latest && !["rejected", "cancelled", "completed"].includes(booking.status) ? (
          <PaymentLinks
            bookingId={booking.id}
            paidFils={paidFils}
            depositFils={latest.deposit_fils}
            totalFils={latest.total_fils}
          />
        ) : null}
        {orders.length ? (
          <ul className="mt-4 divide-y rounded-lg border text-sm">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 p-3">
                {can(staff.permissions, "orders.view") ? (
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="numeric font-medium underline underline-offset-4"
                  >
                    {o.number}
                  </Link>
                ) : (
                  <span className="numeric font-medium">{o.number}</span>
                )}
                <OrderStatusBadge status={o.status} />
                <PaymentStatusBadge status={o.paymentStatus} />
                <span className="numeric ms-auto">{formatAED(o.total_fils)}</span>
                {o.notes ? (
                  <span className="text-muted-foreground w-full text-xs">{o.notes}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </AdminSection>

      <AdminSection title="Messages & notes">
        <BookingMessages
          bookingId={booking.id}
          messages={booking.messages}
          canManage={canManage}
          greeting={waTexts.greeting(booking.contact_name, booking.ref)}
        />
      </AdminSection>
    </div>
  );
}
