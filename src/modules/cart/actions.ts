"use server";

import { fetchAvailability, getCartSettings, listProducts } from "@/modules/storefront/queries";
import { resolveCart, type CartDetails } from "./details";
import { cartDetailsInputSchema } from "./schema";

/**
 * Current product data, live availability and pricing for the visitor's cart. Read-only and
 * public: the cart itself lives in the browser. Product data comes from the cached catalogue
 * (refreshed whenever the admin edits it), so each call costs one live stock read; placing an
 * order re-reads prices uncached (`placeOrder`).
 */
export async function getCartDetails(input: unknown): Promise<CartDetails> {
  const parsed = cartDetailsInputSchema.parse(input);
  const ids = [...new Set(parsed.lines.map((l) => l.variantId))];
  const wanted = new Set(ids);
  const [catalogue, availability, settings] = await Promise.all([
    listProducts(),
    fetchAvailability(ids),
    getCartSettings(),
  ]);
  const products = catalogue.filter((p) => p.variants.some((v) => wanted.has(v.id)));
  return resolveCart(parsed, products, availability, settings);
}
