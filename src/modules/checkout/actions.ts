"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { placeOrder } from "./service";

export async function placeOrderAction(
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string; orderNumber: string }>> {
  try {
    return ok(await placeOrder(input));
  } catch (e) {
    return fail(e);
  }
}
