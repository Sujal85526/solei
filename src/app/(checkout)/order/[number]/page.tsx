import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Check, Clock } from "lucide-react";
import { Container, Eyebrow, OrnamentDivider, PassportStamp } from "@/components/brand";
import { AwaitPayment, ClearCartOnPaid } from "@/components/store/checkout/order-status-client";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { orderLinkSecret } from "@/lib/env.server";
import { formatAED } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { describeSnapshot, type OptionsSnapshot } from "@/modules/catalog/options";
import { verifyOrderToken } from "@/modules/checkout/order-link";
import { confirmOrderReturnAction, retryPaymentAction } from "@/modules/checkout/order-actions";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage(props: PageProps<"/order/[number]">) {
  return (
    <Suspense
      fallback={
        <Container className="text-pearl-muted py-24 text-sm">Loading your order…</Container>
      }
    >
      <OrderView {...props} />
    </Suspense>
  );
}

async function OrderView({ params, searchParams }: PageProps<"/order/[number]">) {
  await connection();
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === "string" ? sp.t : "";
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, number, status, total_fils, subtotal_fils, discount_fils, coupon_code, delivery_fee_fils, delivery_discount_fils, vat_fils, prices_include_vat, contact_name, contact_phone, contact_email, delivery_address, gift_card_purchase, gift_cards(initial_fils, recipient_name, recipient_email), order_lines(product_name, variant_label, qty, line_total_fils, discount_fils, destination_id, options, destinations(name))",
    )
    .eq("number", number.toUpperCase())
    .maybeSingle();
  if (!order || !verifyOrderToken(order.id, token, orderLinkSecret())) notFound();
  const [{ data: summary }, { data: lastPayment }, { data: giftPayments }] = await Promise.all([
    admin
      .from("order_payment_summary")
      .select("payment_status, outstanding_fils")
      .eq("order_id", order.id)
      .single(),
    admin
      .from("payments")
      .select("status")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("payments")
      .select("kind, amount_fils")
      .eq("order_id", order.id)
      .eq("method", "gift_card")
      .eq("status", "succeeded"),
  ]);
  const giftCardPaid = (giftPayments ?? []).reduce(
    (sum, p) => sum + (p.kind === "payment" ? p.amount_fils : -p.amount_fils),
    0,
  );
  const giftCards = order.gift_card_purchase ? order.gift_cards : [];

  const paid = summary?.payment_status === "paid";
  const justReturned = sp.paid === "1";
  const failed = !paid && (lastPayment?.status === "failed" || sp.cancelled === "1");
  const address = (order.delivery_address ?? {}) as Record<string, string>;
  const destinations = [
    ...new Set(order.order_lines.map((l) => l.destinations?.name).filter(Boolean)),
  ] as string[];

  return (
    <Container size="narrow" className="py-14 sm:py-20">
      {/* Buying a gift card leaves the bag as it was. */}
      {paid ? (
        order.gift_card_purchase ? null : (
          <ClearCartOnPaid />
        )
      ) : justReturned && !failed ? (
        <AwaitPayment check={confirmOrderReturnAction.bind(null, order.number, token)} />
      ) : null}
      <div className="flex flex-col items-center gap-5 text-center">
        <Eyebrow>
          {t.order.number} {order.number}
        </Eyebrow>
        {order.status === "cancelled" ? (
          <h1 className="text-4xl">{t.order.cancelled}</h1>
        ) : paid ? (
          <>
            <span className="bg-pink text-burgundy ring-pink-wash flex size-16 items-center justify-center rounded-full ring-8">
              <Check className="size-7" strokeWidth={1.5} />
            </span>
            <h1 className="text-5xl">{t.order.paidTitle}</h1>
            <p className="font-display text-ink-muted max-w-md text-xl italic">
              {order.gift_card_purchase
                ? t.order.giftCardLede(
                    giftCards[0]?.recipient_email ?? order.contact_email ?? "your inbox",
                  )
                : t.order.paidLede}
            </p>
          </>
        ) : justReturned && !failed ? (
          <>
            <Clock className="text-gold size-10 animate-pulse" strokeWidth={1.2} />
            <h1 className="text-4xl">{t.order.confirming}</h1>
          </>
        ) : (
          <>
            <h1 className="text-4xl">{t.order.pendingTitle}</h1>
            <p className="text-muted-foreground max-w-md">
              {failed ? t.order.failedLede : t.order.pendingLede}
            </p>
            <form action={retryPaymentAction.bind(null, order.number, token)}>
              <Button type="submit" size="cta">
                {t.order.completePayment} ·{" "}
                {formatAED(summary?.outstanding_fils ?? order.total_fils)}
              </Button>
            </form>
          </>
        )}
      </div>

      {paid && destinations.length ? (
        <section className="bg-pink-wash mt-12 flex flex-col items-center gap-6 rounded-sm px-6 py-8">
          <p className="eyebrow text-gold-ink">Solei Passport</p>
          <div className="flex flex-wrap justify-center gap-5">
            {destinations.map((d, i) => (
              <PassportStamp
                key={d}
                label={d}
                sublabel="Stamp earned"
                variant="filled"
                tilt={i % 2 ? 6 : -6}
                className="size-24"
              />
            ))}
          </div>
        </section>
      ) : null}

      <OrnamentDivider className="my-12" />
      <div className="bg-card border-border rounded-sm border px-6 py-6 sm:px-8">
        <p className="eyebrow text-muted-foreground mb-4">Order summary</p>
        <ul className="flex flex-col gap-3 text-sm">
          {giftCards.map((g, i) => (
            <li key={`g${i}`} className="flex justify-between gap-4">
              <span>
                Solei gift card
                {g.recipient_name ? (
                  <span className="text-muted-foreground"> · for {g.recipient_name}</span>
                ) : null}
              </span>
              <span className="numeric">{formatAED(g.initial_fils)}</span>
            </li>
          ))}
          {order.order_lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {l.product_name}
                {l.variant_label ? ` · ${l.variant_label}` : ""}{" "}
                <span className="text-muted-foreground">× {l.qty}</span>
                {l.options ? (
                  <span className="text-muted-foreground block text-xs">
                    {describeSnapshot(l.options as OptionsSnapshot)}
                  </span>
                ) : null}
              </span>
              <span className="numeric">{formatAED(l.line_total_fils + l.discount_fils)}</span>
            </li>
          ))}
        </ul>
        <dl className="numeric border-border mt-5 flex flex-col gap-2 border-t pt-4 text-sm">
          {order.discount_fils ? (
            <div className="flex justify-between">
              <dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
              <dd>−{formatAED(order.discount_fils)}</dd>
            </div>
          ) : null}
          <div className={cn("flex justify-between", order.gift_card_purchase && "hidden")}>
            <dt>
              Delivery
              {order.delivery_discount_fils && order.coupon_code ? ` (${order.coupon_code})` : ""}
            </dt>
            <dd>{order.delivery_fee_fils ? formatAED(order.delivery_fee_fils) : "Free"}</dd>
          </div>
          {order.vat_fils ? (
            <div className="text-muted-foreground flex justify-between">
              <dt>{order.prices_include_vat ? "Includes VAT" : "VAT"}</dt>
              <dd>{formatAED(order.vat_fils)}</dd>
            </div>
          ) : null}
          <div className="font-display text-burgundy flex justify-between pt-1 text-xl">
            <dt>Total</dt>
            <dd>{formatAED(order.total_fils)}</dd>
          </div>
          {giftCardPaid > 0 ? (
            <div className="text-muted-foreground flex justify-between">
              <dt>Paid by gift card</dt>
              <dd>−{formatAED(giftCardPaid)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="bg-muted mt-4 grid gap-6 rounded-sm px-6 py-6 text-sm sm:grid-cols-2 sm:px-8">
        <div className={cn(order.gift_card_purchase && "invisible")}>
          <p className="eyebrow text-gold-ink mb-2">Delivering to</p>
          <p>{order.contact_name}</p>
          <p className="text-muted-foreground">
            {[address.line1, address.line2, address.area, address.city].filter(Boolean).join(", ")}
          </p>
          {order.contact_phone ? (
            <p className="text-muted-foreground">{formatPhone(order.contact_phone)}</p>
          ) : null}
        </div>
        <div className="sm:self-end sm:text-end">
          <Link
            href={`/track?number=${order.number}`}
            className="eyebrow text-burgundy underline underline-offset-4"
          >
            {t.order.track}
          </Link>
        </div>
      </div>
    </Container>
  );
}
