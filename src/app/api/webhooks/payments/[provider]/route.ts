import { NextResponse, type NextRequest } from "next/server";
import { applyPaymentEvent } from "@/modules/checkout/payment-events";
import { providerByName } from "@/providers/payment";
import { WebhookSignatureError } from "@/providers/payment/types";

/**
 * Payment webhooks. An online payment becomes "paid" only from a verified source: here, a webhook
 * the provider verified (signature, or shared secret + re-fetch from its API); for N-Genius also the
 * return-to-order-page check (same `applyPaymentEvent`, same dedupe by event id).
 * Returns 2xx for duplicates/ignored events so providers stop retrying; 5xx on processing errors so they retry.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/webhooks/payments/[provider]">,
) {
  const { provider: name } = await ctx.params;
  const provider = providerByName(name);
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const raw = await request.text();
  let event;
  try {
    event = await provider.parseWebhook(raw, request.headers);
  } catch (e) {
    if (e instanceof WebhookSignatureError)
      return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  try {
    const result = await applyPaymentEvent(provider.name, event);
    return NextResponse.json(
      result === "duplicate" ? { received: true, duplicate: true } : { received: true },
    );
  } catch (e) {
    console.error("payment webhook failed", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
