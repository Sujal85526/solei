import "server-only";
import { serverEnv } from "@/lib/env.server";
import { MockProvider } from "./mock";
import { StripeProvider } from "./stripe";
import { ZiinaProvider } from "./ziina";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";

let instance: PaymentProvider | undefined;

/** The configured payment provider (PAYMENT_PROVIDER=ziina|stripe|mock; mock when none is configured). */
export function paymentProvider(): PaymentProvider {
  if (instance) return instance;
  const env = serverEnv();
  instance =
    env.PAYMENT_PROVIDER === "ziina"
      ? new ZiinaProvider()
      : env.PAYMENT_PROVIDER === "stripe"
        ? new StripeProvider()
        : new MockProvider();
  return instance;
}

export function providerByName(name: string): PaymentProvider | null {
  const current = paymentProvider();
  return current.name === name ? current : null;
}
