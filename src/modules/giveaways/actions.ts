"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import * as giveaways from "./service";

function refresh() {
  updateTag(CONTENT_TAGS.catalog);
  revalidatePath("/admin/products", "layout");
}

export async function saveGiveawayAction(input: unknown): Promise<ActionResult> {
  try {
    await giveaways.saveGiveaway(input);
    refresh();
    return ok(undefined, "Giveaway saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveOccasionAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await giveaways.saveOccasion(Object.fromEntries(fd.entries()));
    refresh();
    return ok(res, "Occasion saved.");
  } catch (e) {
    return fail(e);
  }
}
