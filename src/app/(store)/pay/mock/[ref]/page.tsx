import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { Container, Eyebrow, StampFrame } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { serverEnv } from "@/lib/env.server";
import { formatAED } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/server";
import { completeMockPayment } from "@/modules/checkout/mock-actions";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** Local/CI stand-in for the hosted payment page (Stripe Checkout in production). */
export default function MockPaymentPage({ params }: PageProps<"/pay/mock/[ref]">) {
  return (
    <Suspense>
      <MockPayment params={params} />
    </Suspense>
  );
}

async function MockPayment({ params }: { params: PageProps<"/pay/mock/[ref]">["params"] }) {
  await connection();
  if (serverEnv().PAYMENT_PROVIDER !== "mock") notFound();
  const { ref } = await params;
  const { data: payment } = await createAdminClient()
    .from("payments")
    .select("amount_fils, status, orders(number)")
    .eq("provider", "mock")
    .eq("provider_ref", ref)
    .maybeSingle();
  if (!payment) notFound();

  return (
    <Container size="narrow" className="py-20">
      <StampFrame className="mx-auto max-w-md" tone="white">
        <div className="flex flex-col items-center gap-5 p-8 text-center">
          <Eyebrow>Test payment · no real card</Eyebrow>
          <h1 className="text-3xl">Order {payment.orders?.number}</h1>
          <p className="numeric font-display text-burgundy text-4xl">
            {formatAED(payment.amount_fils)}
          </p>
          {payment.status !== "pending" ? (
            <p className="text-ink-muted text-sm">This payment is already {payment.status}.</p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <form action={completeMockPayment.bind(null, ref, "succeeded", "online_card")}>
                <Button type="submit" size="lg" className="w-full">
                  Pay with test card
                </Button>
              </form>
              <form action={completeMockPayment.bind(null, ref, "succeeded", "apple_pay")}>
                <Button type="submit" size="lg" variant="outline" className="w-full">
                  Pay with test Apple Pay
                </Button>
              </form>
              <form action={completeMockPayment.bind(null, ref, "failed", "online_card")}>
                <Button type="submit" variant="ghost" className="w-full">
                  Decline payment
                </Button>
              </form>
            </div>
          )}
          <p className="text-ink-muted text-xs">
            Shown in development and tests instead of Stripe Checkout. Production uses the real
            hosted page.
          </p>
        </div>
      </StampFrame>
    </Container>
  );
}
