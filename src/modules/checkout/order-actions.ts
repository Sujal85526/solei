"use server";

import { redirect } from "next/navigation";
import { orderLinkSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyOrderToken } from "./order-link";
import { confirmOnReturn } from "./payment-events";
import { startPayment } from "./service";

/**
 * Back from the payment page: ask the provider about the pending attempt (N-Genius never retries
 * webhooks). A Server Action, not part of the page render, because confirming refreshes cached
 * stock (`revalidateTag`), which Next only allows in Server Functions and Route Handlers.
 */
export async function confirmOrderReturnAction(number: string, token: string) {
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id")
    .eq("number", number)
    .single();
  if (!order || !verifyOrderToken(order.id, token, orderLinkSecret())) return;
  await confirmOnReturn([order.id]);
}

/** "Complete payment" on the order page — requires the order link token. */
export async function retryPaymentAction(number: string, token: string) {
  const { data: order } = await createAdminClient()
    .from("orders")
    .select("id")
    .eq("number", number)
    .single();
  if (!order || !verifyOrderToken(order.id, token, orderLinkSecret()))
    throw new Error("Invalid order link");
  const url = await startPayment(order.id);
  redirect(url);
}
