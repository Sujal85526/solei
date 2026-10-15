"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import { saveContactDetails } from "./service";

export async function saveContactDetailsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveContactDetails(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/settings/contact");
    return ok(undefined, "Contact details saved.");
  } catch (e) {
    return fail(e);
  }
}
