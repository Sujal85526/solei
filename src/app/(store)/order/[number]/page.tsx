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
import { verifyOrderToken } from "@/modules/checkout/order-link";
import { retryPaymentAction } from "@/modules/checkout/order-actions";

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
      "id, number, status, total_fils, subtotal_fils, delivery_fee_fils, vat_fils, prices_include_vat, contact_name, contact_phone, delivery_address, order_lines(product_name, variant_label, qty, line_total_fils, destination_id, destinations(name))",
    )
    .eq("number", number.toUpperCase())
    .maybeSingle();
  if (!order || !verifyOrderToken(order.id, token, orderLinkSecret())) notFound();
  const [{ data: summary }, { data: lastPayment }] = await Promise.all([
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
  ]);

  const paid = summary?.payment_status === "paid";
  const justReturned = sp.paid === "1";
  const failed = !paid && (lastPayment?.status === "failed" || sp.cancelled === "1");
  const address = (order.delivery_address ?? {}) as Record<string, string>;
  const destinations = [
    ...new Set(order.order_lines.map((l) => l.destinations?.name).filter(Boolean)),
  ] as string[];

  return (
    <Container size="narrow" className="py-16 sm:py-24">
      {paid ? <ClearCartOnPaid /> : justReturned && !failed ? <AwaitPayment /> : null}
      <div className="flex flex-col items-center gap-5 text-center">
        <Eyebrow>
          {t.order.number} {order.number}
        </Eyebrow>
        {order.status === "cancelled" ? (
          <h1 className="text-4xl">{t.order.cancelled}</h1>
        ) : paid ? (
          <>
            <span className="bg-pink text-pink flex size-14 items-center justify-center rounded-full">
              <Check className="size-7" strokeWidth={1.5} />
            </span>
            <h1 className="text-5xl">{t.order.paidTitle}</h1>
            <p className="font-display text-pink max-w-md text-xl italic">{t.order.paidLede}</p>
          </>
        ) : justReturned && !failed ? (
          <>
            <Clock className="text-pink size-10 animate-pulse" strokeWidth={1.2} />
            <h1 className="text-4xl">{t.order.confirming}</h1>
          </>
        ) : (
          <>
            <h1 className="text-4xl">{t.order.pendingTitle}</h1>
            <p className="text-pearl-muted max-w-md">
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
        <div className="mt-12 flex flex-wrap justify-center gap-4">
          {destinations.map((d, i) => (
            <PassportStamp
              key={d}
              label={d}
              sublabel="Stamp earned"
              tilt={i % 2 ? 6 : -6}
              className="size-24"
            />
          ))}
        </div>
      ) : null}

      <OrnamentDivider className="my-12" />
      <ul className="flex flex-col gap-3 text-sm">
        {order.order_lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-4">
            <span>
              {l.product_name}
              {l.variant_label ? ` · ${l.variant_label}` : ""}{" "}
              <span className="text-pearl-muted">× {l.qty}</span>
            </span>
            <span className="numeric">{formatAED(l.line_total_fils)}</span>
          </li>
        ))}
      </ul>
      <dl className="numeric border-pink/15 mt-6 flex flex-col gap-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{order.delivery_fee_fils ? formatAED(order.delivery_fee_fils) : "Free"}</dd>
        </div>
        {order.vat_fils ? (
          <div className="text-pearl-muted flex justify-between">
            <dt>{order.prices_include_vat ? "Includes VAT" : "VAT"}</dt>
            <dd>{formatAED(order.vat_fils)}</dd>
          </div>
        ) : null}
        <div className="font-display text-pink flex justify-between text-xl">
          <dt>Total</dt>
          <dd>{formatAED(order.total_fils)}</dd>
        </div>
      </dl>
      <div className="mt-10 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="eyebrow text-pink/70 mb-2">Delivering to</p>
          <p>{order.contact_name}</p>
          <p className="text-pearl-muted">
            {[address.line1, address.line2, address.area, address.city].filter(Boolean).join(", ")}
          </p>
          {order.contact_phone ? (
            <p className="text-pearl-muted">{formatPhone(order.contact_phone)}</p>
          ) : null}
        </div>
        <div className="sm:text-end">
          <Link
            href={`/track?number=${order.number}`}
            className="eyebrow text-pink underline underline-offset-4"
          >
            {t.order.track}
          </Link>
        </div>
      </div>
    </Container>
  );
}
