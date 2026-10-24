"use server";

import { UserError } from "@/lib/action-result";
import { currentAccount } from "@/modules/account/service";
import { checkCoupon } from "@/modules/coupons/queries";
import { normaliseCode, refusalMessage } from "@/modules/coupons/schema";
import { checkGiftCardForCustomer } from "@/modules/gift-cards/service";
import { giftCardApplies, giftCardRefusalMessage } from "@/modules/gift-cards/schema";
import { fetchAvailability, getCartSettings, listProducts } from "@/modules/storefront/queries";
import { resolveCart, type CartCoupon, type CartDetails, type CartGiftCard } from "./details";
import { cartDetailsInputSchema } from "./schema";

/**
 * Current product data, live availability and pricing for the visitor's cart. Read-only and
 * public: the cart itself lives in the browser. Product data comes from the cached catalogue
 * (refreshed whenever the admin edits it), so each call costs one live stock read; placing an
 * order re-reads prices uncached (`placeOrder`). With a discount code (checkout) the code is
 * checked against the bag and the signed-in customer, and the discount is priced in.
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
  let details = resolveCart(parsed, products, availability, settings);
  const code = parsed.coupon ? normaliseCode(parsed.coupon) : "";
  if (code) {
    const account = await currentAccount();
    const lines = details.lines.filter((l) => l.qty > 0);
    const check = await checkCoupon(code, lines, account?.user.email ?? null);
    const coupon: CartCoupon = check.ok
      ? {
          code: check.code,
          discountFils: Math.min(check.discountFils, details.pricing.subtotalFils),
          freeDelivery: check.freeDelivery,
        }
      : { code, error: refusalMessage(check.reason, check.minOrderFils) };
    details = resolveCart(parsed, products, availability, settings, coupon);
  }
  if (parsed.giftCard) details.giftCard = await giftCardFor(parsed.giftCard, details);
  return details;
}

/** How much of the gift card this order would spend (the order RPC re-checks the balance). */
async function giftCardFor(code: string, details: CartDetails): Promise<CartGiftCard> {
  try {
    const check = await checkGiftCardForCustomer(code);
    if (!check.ok) return { code, error: giftCardRefusalMessage(check.reason) };
    const appliedFils = giftCardApplies(check.balanceFils, details.pricing.totalFils);
    return {
      code: check.code,
      appliedFils,
      balanceFils: check.balanceFils,
      dueFils: details.pricing.totalFils - appliedFils,
    };
  } catch (e) {
    if (e instanceof UserError) return { code, error: e.message };
    throw e;
  }
}
