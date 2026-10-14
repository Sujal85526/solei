"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { LOYALTY_TAG } from "./queries";
import * as loyalty from "./service";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

function refreshCustomer(customerId: string) {
  revalidatePath(`/admin/customers/${customerId}`, "layout");
  revalidatePath("/admin/loyalty");
}

export async function saveSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const res = await loyalty.saveSettings({
      ...entries(fd),
      qualifyingCategoryIds: fd.getAll("qualifyingCategoryIds"),
      qualifyingProductIds: fd.getAll("qualifyingProductIds"),
      rewardProductIds: fd.getAll("rewardProductIds"),
    });
    // Homepage band + passport page read the active rule from a cached query.
    updateTag(LOYALTY_TAG);
    revalidatePath("/admin/loyalty", "layout");
    return ok(
      undefined,
      res.newVersion
        ? "Saved as a new rule version — it applies from now on."
        : "Saved. The rules didn't change.",
    );
  } catch (e) {
    return fail(e);
  }
}

export async function adjustStampsAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ balance: number }>> {
  try {
    const r = await loyalty.adjustStamps(entries(fd));
    refreshCustomer(r.customerId);
    return ok({ balance: r.balance }, "Stamps updated.");
  } catch (e) {
    return fail(e);
  }
}

export async function issuePassportAction(
  customerId: string,
  how: "request" | "manual" = "request",
): Promise<ActionResult<{ number: string }>> {
  try {
    const r = await loyalty.issuePassport({ customerId, how });
    refreshCustomer(customerId);
    return ok({ number: r.number }, `Passport ${r.number} issued.`);
  } catch (e) {
    return fail(e);
  }
}

export async function redeemRewardAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  try {
    const r = await loyalty.redeemReward(entries(fd));
    refreshCustomer(r.customerId);
    revalidatePath("/admin/orders");
    // A reward leaves stock like a sale.
    updateTag("stock");
    return ok(
      { orderId: r.orderId, orderNumber: r.orderNumber },
      `Reward redeemed on order ${r.orderNumber}.`,
    );
  } catch (e) {
    return fail(e);
  }
}
