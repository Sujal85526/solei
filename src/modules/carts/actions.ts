"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import {
  mySavedCart,
  restoreCartFromLink,
  runCartRemindersNow,
  saveCartReminderSettings,
  setMyCartReminders,
  stopRemindersFromLink,
  syncMyCart,
} from "./service";

/** Called (debounced) by the store whenever a signed-in customer's bag changes. */
export async function syncCartAction(lines: unknown): Promise<void> {
  try {
    await syncMyCart(lines);
  } catch (e) {
    // Mirroring the bag must never get in the way of shopping.
    console.error("cart sync failed", e);
  }
}

export async function mySavedCartAction() {
  return mySavedCart();
}

export async function restoreCartAction(
  cartId: string,
  token: string,
): Promise<ActionResult<Awaited<ReturnType<typeof restoreCartFromLink>>>> {
  try {
    return ok(await restoreCartFromLink(cartId, token));
  } catch (e) {
    return fail(e);
  }
}

export async function stopRemindersAction(cartId: string, token: string): Promise<ActionResult> {
  try {
    await stopRemindersFromLink(cartId, token);
    return ok(undefined, "Bag reminders are off.");
  } catch (e) {
    return fail(e);
  }
}

export async function setMyCartRemindersAction(on: boolean): Promise<ActionResult> {
  try {
    await setMyCartReminders(on);
    revalidatePath("/account");
    return ok(undefined, on ? "Bag reminders are on." : "Bag reminders are off.");
  } catch (e) {
    return fail(e);
  }
}

export async function runCartRemindersAction(): Promise<ActionResult> {
  try {
    const r = await runCartRemindersNow();
    revalidatePath("/admin/carts");
    return ok(
      undefined,
      r.sent || r.skipped
        ? `${r.sent} reminder${r.sent === 1 ? "" : "s"} sent${r.skipped ? `, ${r.skipped} skipped` : ""}.`
        : "No bags are due a reminder right now.",
    );
  } catch (e) {
    return fail(e);
  }
}

export async function saveCartReminderSettingsAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await saveCartReminderSettings(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/carts", "layout");
    return ok(undefined, "Reminder settings saved.");
  } catch (e) {
    return fail(e);
  }
}
