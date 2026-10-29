import type { Fils } from "@/lib/money";
import type { CartDetails, CartCoupon } from "@/modules/cart/details";
import { priceCart } from "@/modules/orders/pricing";
import { refusalMessage, type CouponRefusal } from "@/modules/coupons/schema";
import type { CartSettings } from "@/modules/storefront/types";

/**
 * Promotions on a bag, as the database prices them (`promo_price` via `cart_quote` / `pos_quote`):
 * sale prices, then bundles and buy X get Y offers, then codes. The browser only shows these
 * numbers; the order RPCs price the bag again and refuse any difference.
 */

export type QuoteLine = {
  variantId: string;
  qty: number;
  /** Price before any sale (variant + options). */
  listUnitFils: Fils;
  /** Price after the best live sale; what the line is sold at. */
  unitPriceFils: Fils;
  saleName: string | null;
  /** This line's share of the offers and codes. */
  discountFils: Fils;
  rewardId: string | null;
  rewardPoints: number | null;
};

export type AppliedPromotion = {
  type: "sale" | "offer" | "code";
  kind: string;
  name: string | null;
  code: string | null;
  offerId: string | null;
  couponId: string | null;
  discountFils: Fils;
  /** Bundles / buy X get Y: how many times it applied. */
  times: number | null;
};

export type CodeResult =
  | {
      code: string;
      ok: true;
      couponId: string;
      kind: string;
      discountFils: Fils;
      freeDelivery: boolean;
    }
  | {
      code: string;
      ok: false;
      reason: CouponRefusal;
      minOrderFils: Fils | null;
      minItems: number | null;
    };

export type PromoQuote = {
  subtotalFils: Fils;
  discountFils: Fils;
  offerDiscountFils: Fils;
  codeDiscountFils: Fils;
  saleFils: Fils;
  freeDelivery: boolean;
  lines: QuoteLine[];
  applied: AppliedPromotion[];
  codes: CodeResult[];
};

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** The JSON `promo_price` returns, typed. */
export function parseQuote(data: unknown): PromoQuote {
  const r = (data ?? {}) as Raw;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : []);
  return {
    subtotalFils: num(r.subtotal_fils),
    discountFils: num(r.discount_fils),
    offerDiscountFils: num(r.offer_discount_fils),
    codeDiscountFils: num(r.code_discount_fils),
    saleFils: num(r.sale_fils),
    freeDelivery: r.free_delivery === true,
    lines: arr(r.lines).map((l) => ({
      variantId: String(l.variant_id),
      qty: num(l.qty),
      listUnitFils: num(l.list_unit_fils),
      unitPriceFils: num(l.unit_price_fils),
      saleName: str(l.sale_name),
      discountFils: num(l.discount_fils),
      rewardId: str(l.reward_id),
      rewardPoints: l.reward_points == null ? null : num(l.reward_points),
    })),
    applied: arr(r.applied).map((a) => ({
      type: a.type as AppliedPromotion["type"],
      kind: String(a.kind ?? ""),
      name: str(a.name),
      code: str(a.code),
      offerId: str(a.offer_id),
      couponId: str(a.coupon_id),
      discountFils: num(a.discount_fils),
      times: a.times == null ? null : num(a.times),
    })),
    codes: arr(r.codes).map((c): CodeResult =>
      c.ok === true
        ? {
            code: String(c.code),
            ok: true,
            couponId: String(c.coupon_id),
            kind: String(c.kind),
            discountFils: num(c.discount_fils),
            freeDelivery: c.free_delivery === true,
          }
        : {
            code: String(c.code),
            ok: false,
            reason: (c.reason as CouponRefusal) ?? "invalid",
            minOrderFils: c.min_order_fils == null ? null : num(c.min_order_fils),
            minItems: c.min_items == null ? null : num(c.min_items),
          },
    ),
  };
}

/** A code result as the bag shows it: applied, or refused with the reason in customer wording. */
export function toCartCoupon(r: CodeResult): CartCoupon {
  return r.ok
    ? { code: r.code, discountFils: r.discountFils, freeDelivery: r.freeDelivery }
    : { code: r.code, error: refusalMessage(r.reason, r.minOrderFils, r.minItems) };
}

/** Offers (bundles, buy X get Y) the bag gets automatically, for the summary. */
export const appliedOffers = (q: PromoQuote) => q.applied.filter((a) => a.type === "offer");

/**
 * Put the database's prices on a resolved bag: each bought line (qty > 0, in order) takes its sale
 * price and its share of the discounts, and the totals are worked out again with the offers and
 * codes off the goods (and the delivery fee waived by a free-delivery code).
 */
export function applyQuote(
  details: CartDetails,
  quote: PromoQuote,
  settings: CartSettings,
): CartDetails {
  let i = 0;
  const lines = details.lines.map((l) => {
    if (l.qty <= 0) return l;
    const q = quote.lines[i++];
    if (!q || q.variantId !== l.variantId) return l;
    return {
      ...l,
      listUnitFils: q.listUnitFils,
      unitPriceFils: q.unitPriceFils,
      saleName: q.saleName,
      discountFils: q.discountFils,
      rewardPoints: q.rewardPoints,
      lineTotalFils: q.unitPriceFils * l.qty,
    };
  });
  const zone = details.emirate ? settings.zones.find((z) => z.emirate === details.emirate) : null;
  const pricing = priceCart({
    lines: lines
      .filter((l) => l.qty > 0)
      .map((l) => ({ unitPriceFils: l.unitPriceFils, qty: l.qty })),
    vatRateBp: settings.vatRateBp,
    pricesIncludeVat: settings.pricesIncludeVat,
    deliveryFeeFils: zone ? zone.feeFils : null,
    freeDeliveryThresholdFils: settings.freeDeliveryThresholdFils,
    fulfilment: "delivery",
    discountFils: quote.discountFils,
    waiveDelivery: quote.freeDelivery,
  });
  const coupons = quote.codes.map(toCartCoupon);
  return {
    ...details,
    lines,
    pricing,
    coupon: coupons[0] ?? null,
    coupons,
    offers: appliedOffers(quote),
  };
}

/** Codes as typed: trimmed, upper-case, no blanks or repeats, at most `max`. */
export function normaliseCodes(codes: (string | null | undefined)[], max = 5): string[] {
  const out: string[] = [];
  for (const c of codes) {
    const code = (c ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (code && !out.includes(code)) out.push(code);
  }
  return out.slice(0, max);
}

// ── Sale prices on shop cards and product pages (display only) ────────────────────────────────

/** A live sale, with the products it covers (null = every product). */
export type LiveSale = {
  id: string;
  name: string;
  percentBp: number | null;
  amountFils: Fils | null;
  productIds: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
};

/** What a sale takes off one item, rounded half-up to the fils (as `offer_sale_off`). */
export function saleOff(sale: Pick<LiveSale, "percentBp" | "amountFils">, unitFils: Fils): Fils {
  if (sale.percentBp !== null)
    return Math.min(unitFils, Math.floor((unitFils * sale.percentBp + 5000) / 10000));
  return Math.min(sale.amountFils ?? 0, unitFils);
}

/**
 * The best sale running now for a product at a price — the same choice the database makes (the
 * largest reduction; ties to the first sale in the list, which comes sorted like the database's).
 */
export function bestSale(
  productId: string,
  unitFils: Fils,
  sales: LiveSale[],
  now: Date = new Date(),
): { sale: LiveSale; priceFils: Fils } | null {
  let best: { sale: LiveSale; off: Fils } | null = null;
  for (const s of sales) {
    if (s.startsAt && new Date(s.startsAt) > now) continue;
    if (s.endsAt && new Date(s.endsAt) <= now) continue;
    if (s.productIds && !s.productIds.includes(productId)) continue;
    const off = saleOff(s, unitFils);
    if (off > 0 && (!best || off > best.off)) best = { sale: s, off };
  }
  return best ? { sale: best.sale, priceFils: unitFils - best.off } : null;
}
