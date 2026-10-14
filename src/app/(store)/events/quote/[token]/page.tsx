import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, Clock } from "lucide-react";
import { AwaitPayment } from "@/components/store/checkout/order-status-client";
import { QuoteActions } from "@/components/store/events/quote-actions";
import { eventsCopy as c } from "@/content/events";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { getPublicQuote } from "@/modules/bookings/service";

export const metadata: Metadata = { title: c.quote.metaTitle, robots: { index: false } };

export default function QuotePage(props: PageProps<"/events/quote/[token]">) {
  return (
    <Suspense
      fallback={<div className="text-pearl-muted px-6 py-24 text-sm">Loading your quotation…</div>}
    >
      <QuoteView {...props} />
    </Suspense>
  );
}

const longDate = (d: string) =>
  formatBusinessDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

async function QuoteView({ params, searchParams }: PageProps<"/events/quote/[token]">) {
  await connection();
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const q = await getPublicQuote(token);
  if (!q) notFound();

  const outstanding = Math.max(0, q.total_fils - q.paid_fils);
  const closed = ["rejected", "cancelled"].includes(q.booking_status);
  const confirmed = ["confirmed", "completed"].includes(q.booking_status);
  const justPaid = sp.paid === "1";

  let notice: string | null = null;
  let mode: "accept" | "deposit" | "balance" | null = null;
  if (closed) notice = c.quote.closed;
  else if (q.status === "superseded") notice = c.quote.superseded;
  else if (q.status === "withdrawn") notice = c.quote.withdrawn;
  else if (q.status === "sent") {
    if (q.expired) notice = c.quote.expired;
    else if (q.booking_status === "quoted") mode = "accept";
  } else if (q.status === "accepted" && !(justPaid && !confirmed)) {
    if (confirmed) mode = outstanding > 0 ? "balance" : null;
    else if (q.paid_fils === 0 && q.deposit_fils > 0) mode = "deposit";
    else if (outstanding > 0) mode = "balance";
  }

  return (
    <div className="mx-auto grid max-w-[96rem] gap-12 px-6 pt-14 pb-24 sm:px-10 sm:pt-20 lg:grid-cols-12 lg:gap-16 lg:px-14">
      <div className="lg:col-span-7">
        <p className="eyebrow text-pink/70">{c.quote.eyebrow(q.ref, q.version)}</p>
        <h1 className="display mt-5 text-6xl sm:text-7xl">
          {c.quote.title} <span className="italic">{c.quote.titleItalic}</span>
        </h1>
        <p className="font-display text-pearl/85 mt-6 text-xl italic">
          {c.quote.greeting(q.customer_name.split(" ")[0])}
        </p>

        <dl className="border-pink/15 divide-pink/10 mt-10 divide-y border-y text-sm">
          <div className="flex gap-6 py-4">
            <dt className="eyebrow text-pearl-muted w-28 shrink-0">{c.quote.event}</dt>
            <dd className="text-pearl">
              {q.event_type} · {longDate(q.event_date)}, {q.start_time}–{q.end_time}
              <br />
              {q.location}, {c.emirates[q.emirate]} · {q.guests} guests
            </dd>
          </div>
          {q.notes ? (
            <div className="flex gap-6 py-4">
              <dt className="eyebrow text-pearl-muted w-28 shrink-0">{c.quote.notes}</dt>
              <dd className="text-pearl whitespace-pre-line">{q.notes}</dd>
            </div>
          ) : null}
        </dl>

        <table className="mt-10 w-full text-sm">
          <caption className="sr-only">Quotation lines</caption>
          <thead>
            <tr className="border-pink/15 text-pearl-muted border-b">
              <th scope="col" className="eyebrow py-3 text-start font-normal">
                Item
              </th>
              <th scope="col" className="eyebrow py-3 text-end font-normal">
                Qty
              </th>
              <th scope="col" className="eyebrow py-3 text-end font-normal">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={i} className="border-pink/10 border-b">
                <td className="text-pearl py-3 pe-4">{l.label}</td>
                <td className="numeric text-pearl-muted py-3 text-end">
                  {l.qty} × {formatAED(l.unit_price_fils)}
                </td>
                <td className="numeric text-pearl py-3 ps-4 text-end">{formatAED(l.total_fils)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="numeric">
            {q.discount_fils > 0 ? (
              <>
                <tr>
                  <th
                    scope="row"
                    colSpan={2}
                    className="text-pearl-muted pt-4 text-end font-normal"
                  >
                    {c.quote.subtotal}
                  </th>
                  <td className="text-pearl pt-4 text-end">{formatAED(q.subtotal_fils)}</td>
                </tr>
                <tr>
                  <th
                    scope="row"
                    colSpan={2}
                    className="text-pearl-muted pt-2 text-end font-normal"
                  >
                    {c.quote.discount}
                  </th>
                  <td className="text-pearl pt-2 text-end">−{formatAED(q.discount_fils)}</td>
                </tr>
              </>
            ) : null}
            <tr>
              <th scope="row" colSpan={2} className="text-pearl pt-4 text-end font-normal">
                {c.quote.total}
              </th>
              <td
                className="font-display text-pink pt-4 text-end text-3xl"
                data-testid="quote-total"
              >
                {formatAED(q.total_fils)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <aside className="on-blush self-start p-6 sm:p-8 lg:col-span-5">
        {confirmed ? (
          <div className="mb-6" role="status">
            <p className="font-display text-burgundy flex items-center gap-3 text-3xl">
              <Check className="size-6" strokeWidth={1.5} /> {c.quote.confirmedTitle}
            </p>
            <p className="text-ink/80 mt-3 text-sm">{c.quote.confirmedLede}</p>
          </div>
        ) : justPaid && q.status === "accepted" ? (
          <div className="mb-6" role="status">
            <p className="font-display text-burgundy flex items-center gap-3 text-2xl">
              <Clock className="size-5" strokeWidth={1.5} /> {c.quote.confirming}
            </p>
            <AwaitPayment />
          </div>
        ) : q.status === "accepted" ? (
          <div className="mb-6" role="status">
            <p className="font-display text-burgundy text-3xl">{c.quote.acceptedTitle}</p>
            <p className="text-ink/80 mt-2 text-sm">{c.quote.acceptedLede}</p>
          </div>
        ) : null}

        <dl className="numeric flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <dt>{c.quote.total}</dt>
            <dd className="font-medium">{formatAED(q.total_fils)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{c.quote.deposit}</dt>
            <dd className="font-medium">{formatAED(q.deposit_fils)}</dd>
          </div>
          {q.paid_fils > 0 ? (
            <div className="flex justify-between">
              <dt>{c.quote.paid(formatAED(q.paid_fils))}</dt>
              <dd className="font-medium">
                {outstanding > 0 ? formatAED(outstanding) : c.quote.fullyPaid}
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="text-ink/70 mt-3 text-xs">{c.quote.validUntil(longDate(q.valid_until))}</p>

        {sp.cancelled === "1" && mode ? (
          <p className="text-ink/80 mt-6 text-sm">{c.quote.cancelled}</p>
        ) : null}
        {notice ? <p className="text-ink/80 mt-6 text-sm">{notice}</p> : null}
        {mode ? (
          <div className="mt-6">
            <QuoteActions
              token={token}
              mode={mode}
              depositFils={q.deposit_fils}
              outstandingFils={outstanding}
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
