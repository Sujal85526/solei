import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicEnv } from "@/lib/env";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { currentAccount } from "@/modules/account/service";
import { CONTENT_TAGS } from "@/modules/content/queries";
import {
  averageRating,
  type ReviewEligibility,
  type ReviewStatus,
  type ReviewSummary,
} from "./schema";

/** Public URL of a review photo (bucket `reviews`, public read). */
export function reviewPhotoUrl(path: string) {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reviews/${path}`;
}

/** Approved reviews of a product, newest first, with the star average. Cached (tag `reviews`). */
export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.reviews);
  const { data, error } = await createAdminClient()
    .from("product_reviews")
    .select("id, author_name, rating, body, photos, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`reviews failed: ${error.message}`);
  return {
    count: data.length,
    average: averageRating(data.map((r) => r.rating)),
    reviews: data.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: r.rating,
      body: r.body,
      photos: r.photos.map(reviewPhotoUrl),
      createdAt: r.created_at,
    })),
  };
}

/**
 * The order that lets this account review the product (delivered / completed, containing it), or
 * null. Orders: placed while signed in, with the account's email, or of the linked customer.
 */
export async function reviewPurchase(
  user: { id: string; email?: string; app_metadata?: Record<string, unknown> },
  productId: string,
): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc("review_purchase", {
    p_user: user.id,
    p_email: user.email ?? "",
    p_order_ids: (user.app_metadata?.order_ids as string[] | undefined) ?? [],
    p_product: productId,
  });
  if (error) throw new Error(`review_purchase failed: ${error.message}`);
  return data ?? null;
}

/** What the current visitor may do in the product page's review section. */
export async function getReviewEligibility(productId: string): Promise<ReviewEligibility> {
  const account = await currentAccount();
  if (!account) return { state: "signed_out" };
  const { data: mine } = await createAdminClient()
    .from("product_reviews")
    .select("status")
    .eq("product_id", productId)
    .eq("user_id", account.user.id)
    .maybeSingle();
  if (mine) return { state: "reviewed", status: mine.status };
  return (await reviewPurchase(account.user, productId))
    ? { state: "can_review" }
    : { state: "not_purchased" };
}

export type AdminReview = {
  id: string;
  status: ReviewStatus;
  rating: number;
  body: string;
  photos: string[];
  authorName: string;
  createdAt: string;
  moderatedAt: string | null;
  product: { id: string; name: string; slug: string } | null;
  order: { id: string; number: string } | null;
  customer: { id: string; email: string | null } | null;
};

/** Admin → Reviews: one status at a time, newest first, plus pending/approved/declined counts. */
export async function listReviewsForAdmin(status: ReviewStatus) {
  await assertPermission("reviews.manage");
  const supabase = await createClient();
  const [list, counts] = await Promise.all([
    supabase
      .from("product_reviews")
      .select(
        "id, status, rating, body, photos, author_name, created_at, moderated_at, products(id, name, slug), orders(id, number), customers(id, email)",
      )
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" })
      .limit(200),
    supabase.rpc("review_status_counts"),
  ]);
  if (list.error) throw new Error(list.error.message);
  if (counts.error) throw new Error(counts.error.message);
  const tally: Record<ReviewStatus, number> = { pending: 0, approved: 0, declined: 0 };
  for (const r of counts.data) tally[r.status] = r.count;
  const reviews: AdminReview[] = list.data.map((r) => ({
    id: r.id,
    status: r.status,
    rating: r.rating,
    body: r.body,
    photos: r.photos.map(reviewPhotoUrl),
    authorName: r.author_name,
    createdAt: r.created_at,
    moderatedAt: r.moderated_at,
    product: r.products,
    order: r.orders,
    customer: r.customers,
  }));
  return { reviews, counts: tally };
}
