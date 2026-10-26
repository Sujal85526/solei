import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import {
  WebhookSignatureError,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentProvider,
} from "./types";

export const NGENIUS_BASE = {
  sandbox: "https://api-gateway.sandbox.ngenius-payments.com",
  live: "https://api-gateway.ngenius-payments.com",
} as const;

/** Custom header set in the N-Genius portal's webhook settings; its value is NGENIUS_WEBHOOK_SECRET. */
export const NGENIUS_WEBHOOK_HEADER = "x-solei-webhook-secret";

const IDENTITY = "application/vnd.ni-identity.v1+json";
const PAYMENT = "application/vnd.ni-payment.v2+json";
/** Refresh the access token this long before N-Genius says it expires. */
const TOKEN_MARGIN_MS = 30_000;
const REF = /^[A-Za-z0-9-]{6,100}$/;

export type NgeniusPaymentState =
  "STARTED" | "AWAIT_3DS" | "AUTHORISED" | "PURCHASED" | "CAPTURED" | "FAILED" | (string & {});

type Amount = { currencyCode: string; value: number };

export type NgeniusOrder = {
  reference: string;
  action?: string;
  amount: Amount;
  merchantOrderReference?: string;
  _links?: { payment?: { href?: string } };
  _embedded?: {
    payment?: {
      state: NgeniusPaymentState;
      amount?: Amount;
      authResponse?: { resultMessage?: string } | null;
    }[];
  };
};

type Fetch = typeof fetch;

export type NgeniusOptions = {
  apiKey: string;
  outletRef: string;
  sandbox: boolean;
  webhookSecret?: string;
  http?: Fetch;
  now?: () => number;
};

const SUCCESS = new Set(["PURCHASED", "CAPTURED"]);

/**
 * Network International N-Genius hosted payment page (cards + Apple Pay). Amounts are AED in
 * minor units (fils). Card data never touches our servers.
 * N-Genius webhooks are not signed and never retried, so a webhook only has to carry our shared
 * secret header; the order is then re-fetched from the N-Genius API and only NI's own answer
 * (PURCHASED/CAPTURED, AED, the ordered amount) marks it paid. The same check runs when the
 * customer returns to the order page (see modules/checkout/payment-events.ts).
 */
export class NgeniusProvider implements PaymentProvider {
  readonly name = "ngenius";
  private readonly base: string;
  private readonly http: Fetch;
  private readonly now: () => number;
  private token: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(private readonly opts: NgeniusOptions = fromEnv()) {
    if (!opts.apiKey || !opts.outletRef)
      throw new Error("N-Genius is selected but NGENIUS_API_KEY / NGENIUS_OUTLET_REF are not set");
    this.base = opts.sandbox ? NGENIUS_BASE.sandbox : NGENIUS_BASE.live;
    this.http = opts.http ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  /** Access token (valid ~5 minutes), cached in memory until shortly before it expires. */
  private async accessToken(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt) return this.token.value;
    this.pendingToken ??= (async () => {
      try {
        const res = await this.http(`${this.base}/identity/auth/access-token`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${this.opts.apiKey}`,
            "Content-Type": IDENTITY,
            Accept: IDENTITY,
          },
          cache: "no-store",
        });
        if (!res.ok) throw new NgeniusError(res.status, await bodyText(res));
        const json = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!json.access_token) throw new Error("N-Genius did not return an access token");
        const ttlMs = (json.expires_in ?? 300) * 1000;
        this.token = { value: json.access_token, expiresAt: this.now() + ttlMs - TOKEN_MARGIN_MS };
        return json.access_token;
      } finally {
        this.pendingToken = null;
      }
    })();
    return this.pendingToken;
  }

  private async call<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
    const res = await this.http(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        Accept: PAYMENT,
        ...(init?.body ? { "Content-Type": PAYMENT } : {}),
      },
      cache: "no-store",
    });
    if (res.status === 401 && !retried) {
      // Token revoked or expired early — get a fresh one once.
      this.token = null;
      return this.call<T>(path, init, true);
    }
    if (!res.ok) throw new NgeniusError(res.status, await bodyText(res));
    return (await res.json()) as T;
  }

  private ordersPath() {
    return `/transactions/outlets/${encodeURIComponent(this.opts.outletRef)}/orders`;
  }

  async createCheckout(input: CreateCheckoutInput) {
    if (!input.customerEmail) throw new Error("N-Genius needs the customer's email address");
    if (!input.billing) throw new Error("N-Genius needs the customer's billing address");
    const b = input.billing;
    const firstName = clip(b.firstName, 50) || "Solei";
    const order = await this.call<NgeniusOrder>(this.ordersPath(), {
      method: "POST",
      body: JSON.stringify({
        action: "PURCHASE",
        amount: { currencyCode: "AED", value: input.amountFils },
        emailAddress: input.customerEmail,
        billingAddress: {
          firstName,
          lastName: clip(b.lastName, 50) || firstName,
          address1: clip(b.address1, 100) || clip(b.city, 50),
          city: clip(b.city, 50),
          countryCode: "AE",
        },
        merchantOrderReference: input.orderNumber,
        merchantAttributes: {
          redirectUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          skipConfirmationPage: true,
        },
      }),
    });
    const url = order._links?.payment?.href;
    if (!order.reference || !url) throw new Error("N-Genius did not return a payment page URL");
    return { providerRef: order.reference, url };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    const secret = this.opts.webhookSecret;
    if (!secret) throw new WebhookSignatureError("N-Genius webhook secret is not configured");
    if (!sameSecret(headers.get(NGENIUS_WEBHOOK_HEADER) ?? "", secret))
      throw new WebhookSignatureError();
    const reference = orderRefFrom(rawBody);
    if (!reference) throw new WebhookSignatureError("No order reference in webhook");
    // The payload is never trusted: N-Genius's own API decides.
    return this.checkPayment(reference);
  }

  async checkPayment(providerRef: string): Promise<PaymentEvent> {
    if (!REF.test(providerRef)) throw new WebhookSignatureError("Unknown order");
    let order: NgeniusOrder;
    try {
      order = await this.call<NgeniusOrder>(
        `${this.ordersPath()}/${encodeURIComponent(providerRef)}`,
      );
    } catch (e) {
      // Not an order of our outlet → not a genuine notification for us.
      if (e instanceof NgeniusError && [400, 403, 404].includes(e.status))
        throw new WebhookSignatureError("Unknown order");
      throw e;
    }
    return toEvent(order, providerRef);
  }
}

/** Normalise a retrieved N-Genius order into our provider-agnostic event. */
export function toEvent(order: NgeniusOrder, providerRef: string): PaymentEvent {
  const payments = order._embedded?.payment ?? [];
  const payment = payments.find((p) => SUCCESS.has(p.state)) ?? payments[0];
  const state = payment?.state ?? "NO_PAYMENT";
  const eventId = `${providerRef}:${state}`;
  const raw = {
    reference: providerRef,
    state,
    amount: order.amount,
    paymentAmount: payment?.amount ?? null,
  };
  if (payment && SUCCESS.has(state)) {
    const amountOk =
      order.amount?.currencyCode === "AED" &&
      Number.isInteger(order.amount.value) &&
      (!payment.amount ||
        (payment.amount.currencyCode === "AED" && payment.amount.value === order.amount.value));
    if (!amountOk) {
      console.error("N-Genius payment amount/currency mismatch", raw);
      return { kind: "ignored", eventId: `${eventId}:mismatch`, type: "payment.amount_mismatch" };
    }
    return {
      kind: "succeeded",
      eventId,
      providerRef,
      amountFils: order.amount.value,
      method: "online_card",
      raw,
    };
  }
  if (state === "FAILED") {
    return {
      kind: "failed",
      eventId,
      providerRef,
      reason: payment?.authResponse?.resultMessage || "Payment failed",
      raw,
    };
  }
  return { kind: "ignored", eventId, type: `order.${state.toLowerCase()}` };
}

/** The order reference from an N-Genius webhook body ({ order: { reference } }). */
export function orderRefFrom(rawBody: string): string | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const order = (body as { order?: { reference?: unknown } } | null)?.order;
  const ref = order?.reference;
  return typeof ref === "string" && REF.test(ref) ? ref : null;
}

export class NgeniusError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`N-Genius API ${status}: ${body}`);
    this.name = "NgeniusError";
  }
}

function fromEnv(): NgeniusOptions {
  const env = serverEnv();
  return {
    apiKey: env.NGENIUS_API_KEY ?? "",
    outletRef: env.NGENIUS_OUTLET_REF ?? "",
    sandbox: env.NGENIUS_SANDBOX === "1",
    webhookSecret: env.NGENIUS_WEBHOOK_SECRET,
  };
}

function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const clip = (s: string | null | undefined, max: number) =>
  (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const bodyText = (res: Response) =>
  res
    .text()
    .then((t) => t.slice(0, 300))
    .catch(() => "");
