import type { Database } from "@/lib/database.types";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type CheckoutLine = {
  name: string;
  description?: string;
  unitAmountFils: number;
  quantity: number;
  imageUrl?: string;
};

export type CreateCheckoutInput = {
  /** Our order id — echoed back in webhooks as metadata. */
  orderId: string;
  orderNumber: string;
  lines: CheckoutLine[];
  /** Must equal the sum of lines (delivery is passed as a line). */
  amountFils: number;
  customerEmail?: string | null;
  /** Billing name and address (N-Genius requires them). Country is always the UAE. */
  billing?: BillingAddress;
  successUrl: string;
  cancelUrl: string;
};

export type BillingAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  /** City, or the emirate when no city is known. */
  city: string;
};

export type CheckoutSession = { providerRef: string; url: string; expiresAt?: string };

/** Provider-agnostic outcome of a verified webhook. */
export type PaymentEvent =
  | {
      kind: "succeeded";
      eventId: string;
      providerRef: string;
      amountFils: number;
      method: PaymentMethod;
      raw: unknown;
    }
  | { kind: "failed"; eventId: string; providerRef: string; reason: string; raw: unknown }
  | { kind: "ignored"; eventId: string; type: string };

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

/**
 * Card data never touches our servers: every provider uses a hosted payment page.
 * Swappable (N-Genius for the client; Stripe and a mock for tests) — see docs/DECISIONS.md.
 */
export interface PaymentProvider {
  readonly name: string;
  /** The hosted page refuses orders without the customer's email (N-Genius). */
  readonly needsEmail?: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Verify the signature and normalise the event. Throws WebhookSignatureError. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
  /**
   * Ask the provider's API for the payment's current state (by our providerRef). For providers
   * whose webhooks are never retried: the order page calls it when the customer returns.
   * Throws WebhookSignatureError when the provider doesn't know the reference.
   */
  checkPayment?(providerRef: string): Promise<PaymentEvent>;
}
