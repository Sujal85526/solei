"use server";

import { UserError } from "@/lib/action-result";
import { currentAccount } from "@/modules/account/service";
import { checkGiftCardForCustomer } from "@/modules/gift-cards/service";
import { fetchGiveaways } from "@/modules/giveaways/queries";
import { giftCardApplies, giftCardRefusalMessage } from "@/modules/gift-cards/schema";
import { checkoutCustomer, pointsForCheckout } from "@/modules/points/service";
import { priceBag, rewardPointsOf, rewardValueOf } from "@/modules/promotions/bag";
import { listLiveRewards } from "@/modules/promotions/queries";
import { normaliseCodes } from "@/modules/promotions/quote";
import { fetchAvailability, getCartSettings, listProducts } from "@/modules/storefront/queries";
import { resolveCart, type CartDetails, type CartGiftCard } from "./details";
import { cartDetailsInputSchema } from "./schema";

/**
 * Current product data, live availability and pricing for the visitor's cart. Read-only and
 * public: the cart itself lives in the browser. Product data comes from the cached catalogue
 * (refreshed whenever the admin edits it), so each call costs one live stock read; placing an
 * order re-reads prices uncached (`placeOrder`). With a discount code (checkout) the code is
 * checked against the bag and the signed-in customer, and the discount is priced in. Sale prices,
 * bundles, buy X get Y and the codes come from the database (`priceBag`).
 */
export async function getCartDetails(input: unknown): Promise<CartDetails> {
  const parsed = cartDetailsInputSchema.parse(input);
  const rewardIds = parsed.rewards ?? [];
  const codes = normaliseCodes(parsed.coupons ?? [parsed.coupon]);
  const giveawayIds = [
    ...new Set(parsed.lines.flatMap((l) => (l.giveawayId ? [l.giveawayId] : []))),
  ];
  const [catalogue, settings, giveaways, rewards] = await Promise.all([
    listProducts(),
    getCartSettings(),
    fetchGiveaways(giveawayIds),
    rewardIds.length ? listLiveRewards() : [],
  ]);
  const ids = [
    ...new Set([
      ...parsed.lines.map((l) => l.variantId),
      ...rewards.filter((r) => rewardIds.includes(r.id)).map((r) => r.variantId),
    ]),
  ];
  const wanted = new Set(ids);
  const availability = await fetchAvailability(ids);
  const products = catalogue.filter((p) => p.variants.some((v) => wanted.has(v.id)));
  // The signed-in customer (VIP and personal codes, rewards, per-customer limits) — only looked up
  // when a code or a reward needs it, so the bag drawer stays one stock read.
  const account = codes.length || rewardIds.length ? await currentAccount() : null;
  const customer = account && rewardIds.length ? await checkoutCustomer() : null;
  const { details } = await priceBag({
    lines: parsed.lines,
    codes,
    rewardIds: customer ? rewardIds : [],
    email: account?.user.email ?? null,
    customerId: customer?.id ?? null,
    settings,
    resolve: (lines) =>
      resolveCart(
        { lines, emirate: parsed.emirate },
        products,
        availability,
        settings,
        null,
        giveaways,
      ),
  });
  // Rewards first, then points come off, then a gift card covers what it can of the rest.
  const rewardPoints = rewardPointsOf(details);
  let dueFils = details.pricing.totalFils - rewardValueOf(details);
  const points = details.lines.some((l) => l.qty > 0)
    ? await pointsForCheckout(dueFils, rewardPoints)
    : null;
  if (points) {
    const applied = points.usable && Boolean(parsed.usePoints);
    details.points = points.usable
      ? {
          usable: true,
          balance: points.balance,
          points: points.points,
          valueFils: points.valueFils,
          applied,
        }
      : points;
    if (applied && points.usable) dueFils -= points.valueFils;
    const balance = points.balance;
    details.rewardOptions = (await listLiveRewards()).map((r) => ({
      id: r.id,
      name: r.name,
      points: r.points,
      priceFils: r.priceFils,
      affordable: rewardIds.includes(r.id) || r.points <= balance,
    }));
  }
  if (parsed.giftCard) details.giftCard = await giftCardFor(parsed.giftCard, dueFils);
  return details;
}

/** How much of the gift card this order would spend (the order RPC re-checks the balance). */
async function giftCardFor(code: string, dueFils: number): Promise<CartGiftCard> {
  try {
    const check = await checkGiftCardForCustomer(code);
    if (!check.ok) return { code, error: giftCardRefusalMessage(check.reason) };
    const appliedFils = giftCardApplies(check.balanceFils, dueFils);
    return {
      code: check.code,
      appliedFils,
      balanceFils: check.balanceFils,
      dueFils: dueFils - appliedFils,
    };
  } catch (e) {
    if (e instanceof UserError) return { code, error: e.message };
    throw e;
  }
}
