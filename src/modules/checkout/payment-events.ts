import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { onBookingOrderPaid } from "@/modules/bookings/events";
import { onOrderPaid, onPaymentFailed } from "@/modules/orders/events";
import { paymentProvider } from "@/providers/payment";
import type { PaymentEvent } from "@/providers/payment/types";

/**
 * Apply a VERIFIED payment event (a checked webhook, or the provider's own API answer):
 * 1. log it in payment_events (unique per provider + event id → duplicates stop here),
 * 2. confirm/fail through the idempotent RPCs, 3. send the paid / failed notifications once.
 * Shared by the payment webhook and the return-to-order-page check, so the two can race safely.
 * Throws when processing fails; the log row is removed again so a retry can process it.
 */
export async function applyPaymentEvent(
  provider: string,
  event: PaymentEvent,
): Promise<"processed" | "duplicate"> {
  const admin = createAdminClient();
  const { data: logged, error: logError } = await admin
    .from("payment_events")
    .insert({
      provider,
      event_id: event.eventId,
      type: event.kind === "ignored" ? event.type : `payment.${event.kind}`,
      payload: (event.kind === "ignored" ? null : event.raw) as never,
    })
    .select("id")
    .single();
  if (logError) {
    if (logError.code === "23505") return "duplicate";
    throw new Error(`payment event log failed: ${logError.message}`);
  }

  try {
    if (event.kind === "succeeded") {
      // Providers report a card payment; keep "payment_link" when staff sent a link, so reports
      // can tell the two apart.
      const { data: attempt } = await admin
        .from("payments")
        .select("method")
        .eq("provider", provider)
        .eq("provider_ref", event.providerRef)
        .maybeSingle();
      const method = attempt?.method === "payment_link" ? "payment_link" : event.method;
      const { data, error } = await admin
        .rpc("confirm_payment", {
          p_provider: provider,
          p_provider_ref: event.providerRef,
          p_amount_fils: event.amountFils,
          p_method: method,
          p_payload: event.raw as never,
        })
        .single();
      if (error) throw new Error(error.message);
      if (data.newly_paid) {
        await onOrderPaid({ id: data.order_id, number: data.order_number });
        await onBookingOrderPaid(data.order_id);
      }
    } else if (event.kind === "failed") {
      const { data: failedOrderId, error } = await admin.rpc("fail_payment", {
        p_provider: provider,
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
    return "processed";
  } catch (e) {
    await admin.from("payment_events").delete().eq("id", logged.id);
    throw e;
  }
}

/**
 * The customer is back from the hosted payment page: ask the provider for the latest pending
 * attempt on these orders and apply the answer exactly like a webhook. Needed for providers whose
 * webhooks are never retried (N-Genius); a no-op for providers without `checkPayment`.
 * Never throws — the page falls back to waiting for the webhook.
 */
export async function confirmOnReturn(orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  const provider = paymentProvider();
  if (!provider.checkPayment) return;
  const { data: pending } = await createAdminClient()
    .from("payments")
    .select("provider_ref")
    .in("order_id", orderIds)
    .eq("provider", provider.name)
    .eq("status", "pending")
    .not("provider_ref", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pending?.provider_ref) return;
  try {
    const event = await provider.checkPayment(pending.provider_ref);
    await applyPaymentEvent(provider.name, event);
  } catch (e) {
    console.error("payment check on return failed", e instanceof Error ? e.message : e);
  }
}
