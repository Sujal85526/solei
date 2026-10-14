"use server";

import { redirect } from "next/navigation";
import { orderLinkSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyOrderToken } from "./order-link";
import { startPayment } from "./service";

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
