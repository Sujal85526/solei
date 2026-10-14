import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { mockPaymentSecret } from "@/lib/env.server";
import {
  WebhookSignatureError,
  type CreateCheckoutInput,
  type PaymentEvent,
  type PaymentMethod,
  type PaymentProvider,
} from "./types";

export type MockWebhookBody = {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  providerRef: string;
  amountFils: number;
  method?: PaymentMethod;
};

export function signMockPayload(body: string) {
  return createHmac("sha256", mockPaymentSecret()).update(body).digest("hex");
}

/**
 * Local/CI stand-in for a hosted payment page. `/pay/mock/[ref]` lets you approve or decline,
 * then posts an HMAC-signed webhook to `/api/webhooks/payments/mock` — exercising exactly the
 * same verification + confirmation path as Stripe. Refused in production unless explicitly allowed.
 */
export class MockProvider implements PaymentProvider {
  readonly name = "mock";

  async createCheckout(input: CreateCheckoutInput) {
    const ref = `mock_cs_${randomUUID()}`;
    return { providerRef: ref, url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/pay/mock/${ref}` };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent> {
    const signature = headers.get("x-mock-signature") ?? "";
    const expected = signMockPayload(rawBody);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError();
    const body = JSON.parse(rawBody) as MockWebhookBody;
    if (body.type === "payment.succeeded") {
      return {
        kind: "succeeded",
        eventId: body.id,
        providerRef: body.providerRef,
        amountFils: body.amountFils,
        method: body.method ?? "online_card",
        raw: body,
      };
    }
    return {
      kind: "failed",
      eventId: body.id,
      providerRef: body.providerRef,
      reason: "Declined (test)",
      raw: body,
    };
  }
}
