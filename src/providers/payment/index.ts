import "server-only";
import { serverEnv } from "@/lib/env.server";
import { MockProvider } from "./mock";
import { StripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

let instance: PaymentProvider | undefined;

/** The configured payment provider (PAYMENT_PROVIDER=stripe|mock; mock when Stripe isn't configured). */
export function paymentProvider(): PaymentProvider {
  if (instance) return instance;
  const env = serverEnv();
  instance = env.PAYMENT_PROVIDER === "stripe" ? new StripeProvider() : new MockProvider();
  return instance;
}

export function providerByName(name: string): PaymentProvider | null {
  const current = paymentProvider();
  return current.name === name ? current : null;
}
