"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import { saveHelpTopic } from "./service";

export async function saveHelpTopicAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveHelpTopic(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.help);
    revalidatePath("/admin/settings/help");
    return ok(undefined, "Saved — the Help page is updated.");
  } catch (e) {
    return fail(e);
  }
}
