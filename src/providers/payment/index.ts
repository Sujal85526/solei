import "server-only";
import { serverEnv } from "@/lib/env.server";
import { MockProvider } from "./mock";
import { NgeniusProvider } from "./ngenius";
import { StripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

let instance: PaymentProvider | undefined;

/**
 * The configured payment provider (PAYMENT_PROVIDER=ngenius|stripe|mock; N-Genius when its key
 * is set, mock when nothing is configured).
 */
export function paymentProvider(): PaymentProvider {
  if (instance) return instance;
  const env = serverEnv();
  instance =
    env.PAYMENT_PROVIDER === "ngenius"
      ? new NgeniusProvider()
      : env.PAYMENT_PROVIDER === "stripe"
        ? new StripeProvider()
        : new MockProvider();
  return instance;
}

export function providerByName(name: string): PaymentProvider | null {
  const current = paymentProvider();
  return current.name === name ? current : null;
}
