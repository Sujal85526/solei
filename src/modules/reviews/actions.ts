"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import { getReviewEligibility } from "./queries";
import type { ReviewEligibility } from "./schema";
import { moderateReview, submitReview } from "./service";

export async function reviewEligibilityAction(productId: string): Promise<ReviewEligibility> {
  return getReviewEligibility(productId);
}

export async function submitReviewAction(input: unknown): Promise<ActionResult> {
  try {
    await submitReview(input);
    revalidatePath("/admin/reviews");
    return ok(undefined, "Thank you — your review will appear once it's approved.");
  } catch (e) {
    return fail(e);
  }
}

export async function moderateReviewAction(
  id: string,
  status: "approved" | "declined",
): Promise<ActionResult> {
  try {
    await moderateReview(id, status);
    updateTag(CONTENT_TAGS.reviews);
    revalidatePath("/admin/reviews");
    return ok(
      undefined,
      status === "approved"
        ? "Approved — it's on the product page."
        : "Declined — it stays hidden.",
    );
  } catch (e) {
    return fail(e);
  }
}
