import type { Fils } from "@/lib/money";
import type { PromoQuote } from "@/modules/promotions/quote";

/**
 * Till pricing with promotions (pure). The database prices the sale (`pos_quote`); the till shows
 * that and asks for payments that add up to what is left after rewards and points.
 */

export type TillQuote = {
  quote: PromoQuote;
  /** The customer found by the mobile / email typed (points and VIP codes need one). */
  customerId: string | null;
  /** null = programme off or no customer. */
  pointsBalance: number | null;
  /** Points this sale can take as money off (0 = none). */
  usablePoints: number;
  pointValueFils: Fils;
};

/** Sale total: goods at sale prices less offers and codes (VAT-inclusive pricing, as the till). */
export const tillTotal = (q: PromoQuote): Fils => q.subtotalFils - q.discountFils;

/** What the reward lines are worth (paid by points). */
export const tillRewardValue = (q: PromoQuote): Fils =>
  q.lines.reduce((s, l) => s + (l.rewardId ? l.unitPriceFils * l.qty - l.discountFils : 0), 0);

/** Left to pay by cash / card / gift card after rewards and `pointsFils` of points. */
export const tillDue = (q: PromoQuote, pointsFils: Fils): Fils =>
  Math.max(0, tillTotal(q) - tillRewardValue(q) - pointsFils);
