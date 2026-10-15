import "server-only";
import { serverEnv } from "@/lib/env.server";
import {
  WebhookSignatureError,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
} from "./types";

const API = "https://api-v2.ziina.com/api";

export type ZiinaIntent = {
  id: string;
  amount: number;
  currency_code: string;
  status:
    | "requires_payment_instrument"
    | "requires_user_action"
    | "pending"
    | "completed"
    | "failed"
    | "canceled";
  redirect_url?: string;
  latest_error?: { message?: string; code?: string } | null;
};

type Fetch = typeof fetch;

/**
 * Ziina hosted payment page (cards + Apple Pay). Amounts are in fils, AED.
 * Webhooks are not trusted as-is: Ziina doesn't document a signature scheme, so every
 * notification is re-checked by fetching the payment intent from the Ziina API with our secret
 * key — only Ziina's own answer ("completed" and the exact amount) can mark an order paid.
 */
export class ZiinaProvider implements PaymentProvider {
  readonly name = "ziina";

  constructor(
    private readonly apiKey = serverEnv().ZIINA_API_KEY ?? "",
    private readonly testMode = serverEnv().ZIINA_TEST_MODE === "1",
    private readonly http: Fetch = fetch,
  ) {
    if (!this.apiKey) throw new Error("Ziina is selected but ZIINA_API_KEY is not set");
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.http(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ZiinaError(res.status, text.slice(0, 300));
    }
    return (await res.json()) as T;
  }

  async createCheckout(input: CreateCheckoutInput) {
    const intent = await this.call<ZiinaIntent>("/payment_intent", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountFils,
        currency_code: "AED",
        message: `Solei order ${input.orderNumber}`,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        failure_url: input.cancelUrl,
        test: this.testMode,
        expiry: String(Date.now() + 60 * 60 * 1000), // 1 hour, like Stripe
      }),
    });
    if (!intent.redirect_url) throw new Error("Ziina did not return a payment page URL");
    return {
      providerRef: intent.id,
      url: intent.redirect_url,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async parseWebhook(rawBody: string): Promise<PaymentEvent> {
    const id = intentIdFrom(rawBody);
    if (!id) throw new WebhookSignatureError("No payment intent in webhook");
    let intent: ZiinaIntent;
    try {
      intent = await this.call<ZiinaIntent>(`/payment_intent/${encodeURIComponent(id)}`);
    } catch (e) {
      // Unknown to our Ziina account → not a genuine notification for us.
      if (e instanceof ZiinaError && (e.status === 404 || e.status === 400 || e.status === 403))
        throw new WebhookSignatureError("Unknown payment intent");
      throw e;
    }
    const eventId = `${intent.id}:${intent.status}`;
    const raw = { id: intent.id, status: intent.status, amount: intent.amount };
    if (intent.status === "completed" && intent.currency_code === "AED") {
      return {
        kind: "succeeded",
        eventId,
        providerRef: intent.id,
        amountFils: intent.amount,
        method: "online_card",
        raw,
      };
    }
    if (intent.status === "failed" || intent.status === "canceled") {
      return {
        kind: "failed",
        eventId,
        providerRef: intent.id,
        reason:
          intent.status === "canceled"
            ? "Payment cancelled"
            : (intent.latest_error?.message ?? "Payment failed"),
        raw,
      };
    }
    return { kind: "ignored", eventId, type: `payment_intent.${intent.status}` };
  }

  /** One-time setup: point Ziina's webhooks at our endpoint. */
  async registerWebhook(url: string) {
    return this.call<{ success: boolean; error?: string }>("/webhook", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }
}

export class ZiinaError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Ziina API ${status}: ${body}`);
    this.name = "ZiinaError";
  }
}

/** The payment intent id from a webhook body, wherever Ziina puts it. */
export function intentIdFrom(rawBody: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const pick = (o: unknown): string | null => {
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (typeof r.id === "string" && r.id) return r.id;
    if (typeof r.payment_intent_id === "string") return r.payment_intent_id;
    return pick(r.data) ?? pick(r.payment_intent) ?? pick(r.object);
  };
  const id = pick(body);
  return id && /^[A-Za-z0-9_-]{6,100}$/.test(id) ? id : null;
}
