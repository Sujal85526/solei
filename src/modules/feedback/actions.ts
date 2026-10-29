"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { FeedbackStatus } from "./schema";
import { deleteFeedback, saveFeedback, setFeedbackStatus } from "./service";

const refresh = () => {
  revalidatePath("/admin/customers", "layout");
};

export async function saveFeedbackAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveFeedback(Object.fromEntries(fd.entries()));
    refresh();
    return ok(undefined, fd.get("id") ? "Saved." : "Added to the log.");
  } catch (e) {
    return fail(e);
  }
}

export async function setFeedbackStatusAction(
  id: string,
  status: FeedbackStatus,
): Promise<ActionResult> {
  try {
    await setFeedbackStatus(id, status);
    refresh();
    return ok(undefined, "Status updated.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFeedbackAction(id: string): Promise<ActionResult> {
  try {
    await deleteFeedback(id);
    refresh();
    return ok(undefined, "Entry removed.");
  } catch (e) {
    return fail(e);
  }
}
