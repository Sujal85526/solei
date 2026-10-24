import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/orders/order-badges";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { OrderNotes } from "@/components/admin/orders/order-notes";
import { PaymentLinkPanel } from "@/components/admin/orders/payment-link-panel";
import { paymentLinksFor } from "@/modules/orders/manual-queries";
import { AttachCustomerForm } from "@/components/admin/orders/attach-customer-form";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { describeSnapshot, type OptionsSnapshot } from "@/modules/catalog/options";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { orderUrl } from "@/modules/checkout/service";
import { humanize, lineProfit, trackingText } from "@/modules/orders/format";
import { getOrder } from "@/modules/orders/queries";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  nextStatuses,
  type OrderStatus,
} from "@/modules/orders/status";
import { staffDirectory } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Order" };

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "—");

const GUEST_LINK_CHANNELS = new Set(["website", "whatsapp", "direct", "payment_link"]);

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const staff = await requirePagePermission("orders.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, people, links] = await Promise.all([
    getOrder(id),
    staffDirectory(),
    paymentLinksFor(id),
  ]);
  if (!data) notFound();
  const { order, lines, summary, payments, history, notifications } = data;
  const status = order.status as OrderStatus;
  const financial = can(staff.permissions, "reports.financial.view");
  const { forward, back } = nextStatuses(status);
  const refundable = (summary.paid_fils ?? 0) - (summary.refunded_fils ?? 0);
  const address = (order.delivery_address ?? null) as Record<string, string | null> | null;
  const tracking = trackingText(order.tracking_number, order.courier);
  const guestLink = GUEST_LINK_CHANNELS.has(order.channel)
    ? orderUrl(order.id, order.number)
    : null;
  const costKnown = lines.some((l) => l.unit_cost_fils !== null);
  const profit = lines.reduce(
    (s, l) => s + (lineProfit(l.unit_price_fils, l.unit_cost_fils, l.qty)?.profitFils ?? 0),
    0,
  );
  const who = (userId: string | null) => (userId ? (people.get(userId) ?? "Staff") : null);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Orders
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">{order.number}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={status} />
          <PaymentStatusBadge status={summary.payment_status} />
          <ChannelBadge channel={order.channel} />
          {order.events?.name ? <Badge variant="muted">{order.events.name}</Badge> : null}
          <span className="numeric text-muted-foreground text-sm">{when(order.placed_at)}</span>
        </div>
        {status === "cancelled" ? (
          <p className="text-destructive text-sm">
            Cancelled {when(order.cancelled_at)}
            {order.cancel_reason ? ` — ${order.cancel_reason}` : ""}
          </p>
        ) : null}
      </header>

      <AdminSection title="Actions">
        <OrderActions
          orderId={order.id}
          number={order.number}
          status={status}
          forward={forward}
          back={back}
          outstandingFils={summary.outstanding_fils ?? 0}
          refundableFils={refundable}
          hasStock={status !== "pending_payment"}
          trackingNumber={order.tracking_number}
          courier={order.courier}
          can={{
            update: can(staff.permissions, "orders.update"),
            pay: can(staff.permissions, "payments.record"),
            refund: can(staff.permissions, "orders.refund"),
            cancel: can(staff.permissions, "orders.cancel"),
          }}
        />
        {status === "pending_payment" ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Awaiting payment — the order is confirmed (and stock deducted) once it&apos;s fully
            paid, online or recorded here.
          </p>
        ) : null}
      </AdminSection>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <AdminSection title="Items">
            <ul className="divide-y">
              {lines.map((l) => {
                const p = financial ? lineProfit(l.unit_price_fils, l.unit_cost_fils, l.qty) : null;
                return (
                  <li key={l.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {l.product_name}
                        {l.variant_label ? (
                          <span className="text-muted-foreground"> · {l.variant_label}</span>
                        ) : null}
                        {l.is_reward ? (
                          <Badge variant="pink" className="ms-2">
                            Reward
                          </Badge>
                        ) : null}
                      </p>
                      {l.options ? (
                        <p className="text-sm">{describeSnapshot(l.options as OptionsSnapshot)}</p>
                      ) : null}
                      <p className="numeric text-muted-foreground text-xs">
                        <span className="font-mono">{l.sku}</span> · {l.qty} ×{" "}
                        {formatAED(l.unit_price_fils)}
                        {l.unit_price_fils !== l.list_price_fils ? (
                          <> (list {formatAED(l.list_price_fils)})</>
                        ) : null}
                      </p>
                      {l.price_override_reason ? (
                        <p className="text-muted-foreground text-xs">
                          Price note: {l.price_override_reason}
                        </p>
                      ) : null}
                      {p ? (
                        <p className="numeric text-muted-foreground text-xs">
                          Cost {formatAED(l.unit_cost_fils ?? 0)} · profit {formatAED(p.profitFils)}
                          {p.marginBp !== null ? ` (${(p.marginBp / 100).toFixed(1)}%)` : ""}
                        </p>
                      ) : null}
                    </div>
                    <p className="numeric shrink-0 font-semibold">
                      {formatAED(l.line_total_fils + l.discount_fils)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <dl className="numeric mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-end">{formatAED(order.subtotal_fils)}</dd>
              {order.discount_fils > 0 ? (
                <>
                  <dt className="text-muted-foreground">
                    Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}
                  </dt>
                  <dd className="text-end">−{formatAED(order.discount_fils)}</dd>
                </>
              ) : null}
              {order.fulfilment === "delivery" ? (
                <>
                  <dt className="text-muted-foreground">
                    Delivery
                    {order.delivery_discount_fils > 0 && order.coupon_code
                      ? ` (${order.coupon_code}, ${formatAED(order.delivery_discount_fils)} waived)`
                      : ""}
                  </dt>
                  <dd className="text-end">
                    {order.delivery_fee_fils ? formatAED(order.delivery_fee_fils) : "Free"}
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">
                VAT {(order.vat_rate_bp / 100).toFixed(0)}%
                {order.prices_include_vat ? " (included)" : ""}
              </dt>
              <dd className="text-end">{formatAED(order.vat_fils)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-end font-semibold">{formatAED(order.total_fils)}</dd>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="text-end">{formatAED(summary.paid_fils ?? 0)}</dd>
              {(summary.refunded_fils ?? 0) > 0 ? (
                <>
                  <dt className="text-muted-foreground">Refunded</dt>
                  <dd className="text-end">−{formatAED(summary.refunded_fils ?? 0)}</dd>
                </>
              ) : null}
              <dt className={cn((summary.outstanding_fils ?? 0) > 0 && "text-[#8A5108]")}>
                Outstanding
              </dt>
              <dd
                className={cn(
                  "text-end",
                  (summary.outstanding_fils ?? 0) > 0 && "font-semibold text-[#8A5108]",
                )}
                data-testid="outstanding"
              >
                {formatAED(Math.max(0, summary.outstanding_fils ?? 0))}
              </dd>
              {financial && costKnown ? (
                <>
                  <dt className="text-muted-foreground">Gross profit (goods)</dt>
                  <dd className="text-end">{formatAED(profit)}</dd>
                </>
              ) : null}
            </dl>
          </AdminSection>

          <AdminSection title="Payments & refunds">
            {payments.length ? (
              <ul className="divide-y text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.kind === "refund" ? "Refund" : "Payment"} ·{" "}
                        {PAYMENT_METHOD_LABELS[p.method]}
                        <Badge
                          variant={
                            p.status === "succeeded"
                              ? "success"
                              : p.status === "failed"
                                ? "destructive"
                                : "muted"
                          }
                          className="ms-2"
                        >
                          {humanize(p.status)}
                        </Badge>
                      </p>
                      <p className="numeric text-muted-foreground text-xs">
                        {when(p.received_at ?? p.created_at)}
                        {who(p.received_by) ? ` · ${who(p.received_by)}` : ""}
                        {p.provider ? ` · ${p.provider}` : ""}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                      </p>
                      {p.note ? <p className="text-muted-foreground text-xs">{p.note}</p> : null}
                    </div>
                    <p
                      className={cn(
                        "numeric shrink-0 font-semibold",
                        p.kind === "refund" && "text-destructive",
                        p.status !== "succeeded" && "text-muted-foreground line-through",
                      )}
                    >
                      {p.kind === "refund" ? "−" : ""}
                      {formatAED(p.amount_fils)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No payments yet.</p>
            )}
          </AdminSection>

          <AdminSection
            title="Payment links"
            description="Hosted, secure links — cards or Apple Pay. Paid links update the order automatically."
          >
            <PaymentLinkPanel
              orderId={order.id}
              outstandingFils={status === "cancelled" ? 0 : (summary.outstanding_fils ?? 0)}
              links={links}
              canCreate={can(staff.permissions, "payment_links.create")}
              hasEmail={Boolean(order.contact_email)}
            />
          </AdminSection>

          <AdminSection title="History">
            <ol className="relative flex flex-col gap-4 border-s ps-5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span
                    aria-hidden
                    className="bg-burgundy absolute -start-[1.66rem] top-1.5 size-2.5 rounded-full"
                  />
                  <p className="font-medium">{ORDER_STATUS_LABELS[h.to_status]}</p>
                  <p className="numeric text-muted-foreground text-xs">
                    {when(h.created_at)}
                    {who(h.changed_by) ? ` · ${who(h.changed_by)}` : ""}
                  </p>
                  {h.note ? <p className="text-muted-foreground text-xs">{h.note}</p> : null}
                </li>
              ))}
            </ol>
          </AdminSection>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <AdminSection title="Customer">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd className="font-medium">{order.contact_name || "Walk-in customer"}</dd>
              </div>
              {order.contact_phone ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${order.contact_phone}`}
                      className="numeric underline-offset-4 hover:underline"
                    >
                      {formatPhone(order.contact_phone)}
                    </a>
                  </dd>
                </div>
              ) : null}
              {order.contact_email ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Email</dt>
                  <dd className="break-all">
                    <a
                      href={`mailto:${order.contact_email}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {order.contact_email}
                    </a>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs">Fulfilment</dt>
                <dd>
                  {humanize(order.fulfilment)}
                  {order.fulfilment === "delivery" && order.delivery_emirate
                    ? ` · ${humanize(order.delivery_emirate)}`
                    : ""}
                </dd>
              </div>
              {address ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Delivery address</dt>
                  <dd className="whitespace-pre-line">
                    {[address.line1, address.line2, address.area, address.city]
                      .filter(Boolean)
                      .join("\n")}
                  </dd>
                </div>
              ) : null}
              {tracking ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Shipping</dt>
                  <dd>{tracking}</dd>
                </div>
              ) : null}
              {order.notes ? (
                <div>
                  <dt className="text-muted-foreground text-xs">Customer note</dt>
                  <dd className="whitespace-pre-wrap">{order.notes}</dd>
                </div>
              ) : null}
            </dl>
            {order.customer_id ? (
              <Link
                href={`/admin/customers/${order.customer_id}`}
                className="text-burgundy mt-4 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                Customer record & Passport
              </Link>
            ) : null}
            {can(staff.permissions, "orders.update") &&
            order.status !== "cancelled" &&
            (!order.customer_id || !order.contact_email || !order.contact_phone) ? (
              <div className="mt-4">
                <AttachCustomerForm
                  orderId={order.id}
                  email={order.contact_email}
                  phone={order.contact_phone}
                  hasCustomer={Boolean(order.customer_id)}
                />
              </div>
            ) : null}
            {guestLink ? (
              <a
                href={guestLink}
                target="_blank"
                rel="noreferrer"
                className="text-burgundy mt-4 inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                Customer&apos;s order page <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </AdminSection>

          <AdminSection title="Internal notes" description="Only staff see these.">
            <OrderNotes
              orderId={order.id}
              notes={order.internal_notes}
              editable={can(staff.permissions, "orders.update")}
            />
          </AdminSection>

          <AdminSection title="Emails">
            {notifications.length ? (
              <ul className="divide-y text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="py-2.5">
                    <p className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {n.subject ?? humanize(n.template_key)}
                      </span>
                      <Badge
                        variant={
                          n.status === "sent"
                            ? "success"
                            : n.status === "failed"
                              ? "destructive"
                              : "muted"
                        }
                      >
                        {humanize(n.status)}
                      </Badge>
                    </p>
                    <p className="numeric text-muted-foreground truncate text-xs">
                      {when(n.created_at)} · {n.recipient}
                      {n.error ? ` · ${n.error}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No emails for this order yet.</p>
            )}
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
