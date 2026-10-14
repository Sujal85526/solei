"use server";

import {
  fetchAvailability,
  fetchProductsForVariants,
  getCartSettings,
} from "@/modules/storefront/queries";
import { resolveCart, type CartDetails } from "./details";
import { cartDetailsInputSchema } from "./schema";

/**
 * Current product data, live availability and pricing for the visitor's cart. Read-only and
 * public: the cart itself lives in the browser; this is the single source of truth for prices.
 */
export async function getCartDetails(input: unknown): Promise<CartDetails> {
  const parsed = cartDetailsInputSchema.parse(input);
  const ids = [...new Set(parsed.lines.map((l) => l.variantId))];
  const [products, availability, settings] = await Promise.all([
    fetchProductsForVariants(ids),
    fetchAvailability(ids),
    getCartSettings(),
  ]);
  return resolveCart(parsed, products, availability, settings);
}
