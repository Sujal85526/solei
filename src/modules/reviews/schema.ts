import { z } from "zod";

/**
 * Product reviews: only customers who received the product can write one (stars, text, up to 3
 * photos); it appears on the product page once the owner approves it. Declined reviews stay
 * hidden. One review per product per account.
 */

export type ReviewStatus = "pending" | "approved" | "declined";

export const MAX_REVIEW_PHOTOS = 3;
export const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;
export const REVIEW_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const reviewInputSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5, "Choose a star rating"),
  body: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least a sentence")
    .max(2000, "Keep it under 2000 characters"),
  photos: z.array(z.string().min(1).max(300)).max(MAX_REVIEW_PHOTOS).default([]),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  photos: string[];
  createdAt: string;
};

export type ReviewSummary = { count: number; average: number; reviews: PublicReview[] };

/** What the signed-in visitor can do on a product page. */
export type ReviewEligibility =
  | { state: "signed_out" }
  | { state: "not_purchased" }
  | { state: "can_review" }
  | { state: "reviewed"; status: ReviewStatus };

/** "Reem A." from the account's first and last name; never the email. */
export function authorName(first?: string | null, last?: string | null): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f) return "Solei customer";
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

/** Average to one decimal, e.g. 4.7. */
export function averageRating(ratings: number[]): number {
  if (!ratings.length) return 0;
  return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
}
