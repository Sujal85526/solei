import "server-only";
import type { CartDetails } from "@/modules/cart/details";
import type { CartLine } from "@/modules/cart/schema";
import type { CartSettings } from "@/modules/storefront/types";
import { listLiveRewards, quoteCart } from "./queries";
import { applyQuote, type PromoQuote } from "./quote";
import type { PointsReward } from "./schema";

/**
 * A website bag with its promotions: the chosen points rewards are added as lines of their own
 * (one piece each), the bag is resolved (catalogue, stock) by the caller's `resolve`, then priced by
 * the database (`cart_quote`) and the prices put on the lines. Shared by the bag / checkout summary
 * (`getCartDetails`) and placing the order (`placeOrder`), so both price the same way.
 */
export async function priceBag(opts: {
  lines: CartLine[];
  codes: string[];
  rewardIds: string[];
  email: string | null;
  customerId: string | null;
  settings: CartSettings;
  /** resolveCart with the caller's catalogue, availability and settings. */
  resolve: (lines: CartLine[]) => CartDetails;
}): Promise<{ details: CartDetails; quote: PromoQuote | null; rewards: PointsReward[] }> {
  const rewards = opts.rewardIds.length || opts.customerId ? await listLiveRewards() : [];
  const chosen = opts.rewardIds
    .map((id) => rewards.find((r) => r.id === id))
    .filter((r): r is PointsReward => Boolean(r));
  const resolved = opts.resolve([
    ...opts.lines,
    ...chosen.map((r) => ({ variantId: r.variantId, qty: 1 })),
  ]);
  const n = opts.lines.length;
  const details: CartDetails = {
    ...resolved,
    lines: resolved.lines.map((l, i) =>
      i < n ? l : { ...l, key: `reward:${chosen[i - n].id}`, rewardId: chosen[i - n].id },
    ),
  };
  const bought = details.lines.filter((l) => l.qty > 0);
  if (!bought.length) return { details, quote: null, rewards };
  const quote = await quoteCart(
    bought.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      options: l.options,
      giveawayId: l.giveawayId,
      rewardId: l.rewardId,
    })),
    opts.codes,
    opts.email,
    opts.customerId,
  );
  return { details: applyQuote(details, quote, opts.settings), quote, rewards };
}

/** Points the chosen reward lines cost (lines still in stock). */
export const rewardPointsOf = (details: CartDetails) =>
  details.lines.reduce((s, l) => s + (l.qty > 0 && l.rewardId ? (l.rewardPoints ?? 0) : 0), 0);

/** What the chosen reward lines are worth (paid by points). */
export const rewardValueOf = (details: CartDetails) =>
  details.lines.reduce((s, l) => s + (l.qty > 0 && l.rewardId ? l.lineTotalFils : 0), 0);
