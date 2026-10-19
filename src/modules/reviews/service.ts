import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { currentAccount } from "@/modules/account/service";
import { reviewPurchase } from "./queries";
import { authorName, reviewInputSchema, type ReviewStatus } from "./schema";

/**
 * A customer's review, saved as pending. Only for a product in one of their delivered / completed
 * orders; one per product. Photos must already be uploaded into the customer's own folder.
 */
export async function submitReview(input: unknown) {
  const account = await currentAccount();
  if (!account) throw new UserError("Please sign in to write a review.");
  const v = reviewInputSchema.parse(input);
  const { user, meta } = account;
  if (v.photos.some((p) => !p.startsWith(`${user.id}/`) || p.includes(".."))) {
    throw new UserError("Please upload your photos again.");
  }
  const orderId = await reviewPurchase(user, v.productId);
  if (!orderId) {
    throw new UserError("Only customers who have received this product can review it.");
  }
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("customer_id")
    .eq("id", orderId)
    .single();
  const { error } = await admin.from("product_reviews").insert({
    product_id: v.productId,
    user_id: user.id,
    order_id: orderId,
    customer_id: order?.customer_id ?? null,
    author_name: authorName(meta.first_name, meta.last_name),
    rating: v.rating,
    body: v.body,
    photos: v.photos,
  });
  if (error) {
    if (error.code === "23505") throw new UserError("You've already reviewed this product.");
    throw new Error(error.message);
  }
}

/** Approve (show on the product page) or decline (keep hidden). Audited by trigger. */
export async function moderateReview(id: string, status: Exclude<ReviewStatus, "pending">) {
  const staff = await assertPermission("reviews.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_reviews")
    .update({ status, moderated_at: new Date().toISOString(), moderated_by: staff.userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
