"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { signMockPayload, type MockWebhookBody } from "@/providers/payment/mock";

/** Test checkout only: simulate the hosted page's outcome by sending a signed webhook to ourselves. */
export async function completeMockPayment(
  ref: string,
  outcome: "succeeded" | "failed",
  method: "online_card" | "apple_pay",
) {
  if (serverEnv().PAYMENT_PROVIDER !== "mock") throw new Error("Mock payments are disabled");
  const { data: payment } = await createAdminClient()
    .from("payments")
    .select("amount_fils, provider_payload")
    .eq("provider", "mock")
    .eq("provider_ref", ref)
    .single();
  if (!payment) throw new Error("Unknown test payment");

  const body: MockWebhookBody = {
    id: `evt_mock_${randomUUID()}`,
    type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
    providerRef: ref,
    amountFils: payment.amount_fils,
    method,
  };
  const raw = JSON.stringify(body);
  const res = await fetch(`${publicEnv.NEXT_PUBLIC_SITE_URL}/api/webhooks/payments/mock`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-mock-signature": signMockPayload(raw) },
    body: raw,
  });
  if (!res.ok) throw new Error(`Mock webhook failed: ${res.status}`);

  const urls = (payment.provider_payload ?? {}) as { success_url?: string; cancel_url?: string };
  redirect((outcome === "succeeded" ? urls.success_url : urls.cancel_url) ?? "/");
}
