import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";
import {
  WebhookSignatureError,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentMethod,
  type PaymentProvider,
} from "./types";

/** Stripe Checkout (hosted page: cards + Apple Pay). Test mode only in Phase 1. */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private client: Stripe;
  private webhookSecret: string;

  constructor() {
    const env = serverEnv();
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error(
        "Stripe is selected but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not set",
      );
    }
    this.client = new Stripe(env.STRIPE_SECRET_KEY);
    this.webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  }

  async createCheckout(input: CreateCheckoutInput) {
    const session = await this.client.checkout.sessions.create(
      {
        mode: "payment",
        currency: "aed",
        customer_email: input.customerEmail ?? undefined,
        client_reference_id: input.orderId,
        metadata: { order_id: input.orderId, order_number: input.orderNumber },
        payment_intent_data: {
          metadata: { order_id: input.orderId, order_number: input.orderNumber },
        },
        line_items: input.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: "aed",
            unit_amount: l.unitAmountFils,
            product_data: {
              name: l.name,
              description: l.description,
              images: l.imageUrl?.startsWith("https://") ? [l.imageUrl] : undefined,
            },
          },
        })),
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      { idempotencyKey: `checkout-${input.orderId}-${input.amountFils}-${Date.now() >> 16}` },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return {
      providerRef: session.id,
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : undefined,
    };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    const signature = headers.get("stripe-signature");
    if (!signature) throw new WebhookSignatureError("Missing stripe-signature header");
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new WebhookSignatureError();
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status !== "paid")
          return { kind: "ignored", eventId: event.id, type: event.type };
        return {
          kind: "succeeded",
          eventId: event.id,
          providerRef: session.id,
          amountFils: session.amount_total ?? 0,
          method: await this.methodOf(session),
          raw: {
            id: session.id,
            payment_intent: session.payment_intent,
            amount_total: session.amount_total,
          },
        };
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object;
        return {
          kind: "failed",
          eventId: event.id,
          providerRef: session.id,
          reason: event.type === "checkout.session.expired" ? "Checkout expired" : "Payment failed",
          raw: { id: session.id },
        };
      }
      default:
        return { kind: "ignored", eventId: event.id, type: event.type };
    }
  }

  /** Card vs Apple Pay, from the PaymentIntent's charge. */
  private async methodOf(session: Stripe.Checkout.Session): Promise<PaymentMethod> {
    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!piId) return "online_card";
    try {
      const pi = await this.client.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
      const charge = pi.latest_charge as Stripe.Charge | null;
      return charge?.payment_method_details?.card?.wallet?.type === "apple_pay"
        ? "apple_pay"
        : "online_card";
    } catch {
      return "online_card";
    }
  }
}
