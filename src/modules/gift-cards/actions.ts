"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { GiftCardCheck } from "./queries";
import {
  adjustGiftCard,
  buyGiftCard,
  checkGiftCardAtTill,
  issueGiftCard,
  resendGiftCard,
  saveGiftCardSettings,
  voidGiftCard,
} from "./service";

export async function buyGiftCardAction(
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    return ok(await buyGiftCard(input));
  } catch (e) {
    return fail(e);
  }
}

export async function checkGiftCardAtTillAction(
  code: string,
): Promise<ActionResult<GiftCardCheck>> {
  try {
    return ok(await checkGiftCardAtTill(code));
  } catch (e) {
    return fail(e);
  }
}

export async function issueGiftCardAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await issueGiftCard(Object.fromEntries(fd.entries()));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/gift-cards");
  redirect(`/admin/gift-cards/${id}?issued=1`);
}

export async function voidGiftCardAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await voidGiftCard(Object.fromEntries(fd.entries()));
    revalidatePath("/admin/gift-cards", "layout");
    return ok(undefined, "Gift card voided.");
  } catch (e) {
    return fail(e);
  }
}

export async function adjustGiftCardAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await adjustGiftCard(Object.fromEntries(fd.entries()));
    revalidatePath("/admin/gift-cards", "layout");
    return ok(undefined, "Balance updated.");
  } catch (e) {
    return fail(e);
  }
}

export async function resendGiftCardAction(id: string): Promise<ActionResult> {
  try {
    await resendGiftCard(id);
    revalidatePath(`/admin/gift-cards/${id}`);
    return ok(undefined, "Gift card emailed.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveGiftCardSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveGiftCardSettings(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/gift-cards", "layout");
    return ok(undefined, "Gift card settings saved.");
  } catch (e) {
    return fail(e);
  }
}
