/**
 * Cache tags shared by the storefront read models, so admin edits can `revalidateTag` /
 * `updateTag` exactly what changed.
 */
export const CONTENT_TAGS = {
  catalog: "catalog",
  settings: "settings",
  /** Help centre topics (policies). */
  help: "help",
  loyalty: "loyalty",
  /** Approved product reviews (product pages). */
  reviews: "reviews",
  /** Online availability (stock ledger); revalidate after sales, receipts and adjustments. */
  stock: "stock",
} as const;
