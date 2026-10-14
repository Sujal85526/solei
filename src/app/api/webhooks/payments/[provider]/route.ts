import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { onOrderPaid, onPaymentFailed } from "@/modules/orders/events";
import { providerByName } from "@/providers/payment";
import { WebhookSignatureError } from "@/providers/payment/types";

/**
 * Payment webhooks. The ONLY place an online payment becomes "paid":
 * 1. verify the provider signature, 2. dedupe by event id, 3. confirm/fail via idempotent RPCs.
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

  const admin = createAdminClient();
  const { data: logged, error: logError } = await admin
    .from("payment_events")
    .insert({
      provider: provider.name,
      event_id: event.eventId,
      type: event.kind === "ignored" ? event.type : `payment.${event.kind}`,
      payload: (event.kind === "ignored" ? null : event.raw) as never,
    })
    .select("id")
    .single();
  if (logError) {
    if (logError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }

  try {
    if (event.kind === "succeeded") {
      const { data, error } = await admin
        .rpc("confirm_payment", {
          p_provider: provider.name,
          p_provider_ref: event.providerRef,
          p_amount_fils: event.amountFils,
          p_method: event.method,
          p_payload: event.raw as never,
        })
        .single();
      if (error) throw new Error(error.message);
      if (data.newly_paid) await onOrderPaid({ id: data.order_id, number: data.order_number });
    } else if (event.kind === "failed") {
      const { data: failedOrderId, error } = await admin.rpc("fail_payment", {
        p_provider: provider.name,
        p_provider_ref: event.providerRef,
        p_reason: event.reason,
      });
      if (error) throw new Error(error.message);
      // Null when the attempt was already superseded/settled — no retry email then.
      if (failedOrderId) await onPaymentFailed(failedOrderId);
    }
    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", logged.id);
    return NextResponse.json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Allow the provider's retry to process it again.
    await admin.from("payment_events").delete().eq("id", logged.id);
    console.error("payment webhook failed", message);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
