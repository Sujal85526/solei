import { productTypeLabel } from "@/modules/storefront/labels";
import type { Fils } from "@/lib/money";
import { priceCart, type CartPricing } from "@/modules/orders/pricing";
import type {
  Availability,
  CartSettings,
  StoreImage,
  StoreProduct,
} from "@/modules/storefront/types";
import {
  describeChoices,
  optionsProblem,
  unitPriceWithOptions,
  type LineOptions,
} from "@/modules/catalog/options";
import type { StoreGiveaway } from "@/modules/giveaways/types";
import type { AppliedPromotion } from "@/modules/promotions/quote";
import { keyOf } from "./logic";
import type { CartDetailsInput, Emirate } from "./schema";

/**
 * Resolve a client cart ({ variantId, qty }[]) against the current catalog, live availability
 * and settings. Pure — the server action supplies the data.
 */

export type CartLineStatus =
  /** Fully available. */
  | "ok"
  /** Fewer units available than requested — quantity reduced. */
  | "clamped"
  /** Product exists but nothing is available online. */
  | "sold_out"
  /** Variant no longer sold (removed, deactivated). */
  | "unavailable";

export type CartDetailLine = {
  /** Line identity (variant id, plus options for customised products). */
  key: string;
  variantId: string;
  /** Giveaways: the choices, and the same in words ("Ribbon: Gold · Name on the tag: Sara"). */
  options?: LineOptions;
  /** The giveaway the bottle is bought through (its name leads `optionsText`). */
  giveawayId?: string;
  optionsText: string;
  /** Fewest pieces of this product per order (1 for ordinary products). */
  minQty: number;
  requestedQty: number;
  /** Quantity that can actually be bought (0 for sold out / unavailable). */
  qty: number;
  available: number;
  status: CartLineStatus;
  product: {
    slug: string;
    name: string;
    categoryName: string;
    /** "Eau de parfum" / "All over spray". */
    typeLabel: string;
    destinationName: string | null;
    image: StoreImage;
  } | null;
  variantLabel: string;
  /** True when the product has more than one variant (show the label). */
  hasVariants: boolean;
  unitPriceFils: Fils;
  lineTotalFils: Fils;
  /** Promotions (from the database quote): the price before a sale, the sale, the line's share
   * of offers and codes, and the points when the line is a reward. */
  listUnitFils?: Fils;
  saleName?: string | null;
  discountFils?: Fils;
  rewardPoints?: number | null;
  /** The points reward this line is (bought with points at checkout). */
  rewardId?: string;
};

/**
 * A discount code on the bag: applied (goods discount, and whether it waives delivery) or refused
 * (with the reason).
 */
export type CartCoupon =
  { code: string; discountFils: Fils; freeDelivery: boolean } | { code: string; error: string };

/**
 * A gift card on the order: how much of it this order spends (and what's left to pay by card), or
 * why it was refused. It pays for the order; it doesn't change the prices.
 */
export type CartGiftCard =
  | { code: string; appliedFils: Fils; balanceFils: Fils; dueFils: Fils }
  | { code: string; error: string };

export type CartDetails = {
  lines: CartDetailLine[];
  pricing: CartPricing;
  coupon: CartCoupon | null;
  /** Every code typed, applied or refused (the first one is also `coupon`). */
  coupons?: CartCoupon[];
  /** Bundles and buy X get Y offers the bag gets automatically. */
  offers?: AppliedPromotion[];
  /** Points rewards the signed-in customer can choose at checkout (programme on). */
  rewardOptions?: {
    id: string;
    name: string;
    points: number;
    priceFils: Fils;
    affordable: boolean;
  }[];
  giftCard?: CartGiftCard | null;
  /**
   * The signed-in customer's points at checkout (programme on): whether they can be used here and,
   * when chosen, how many come off (before any gift card).
   */
  points?:
    | {
        usable: true;
        balance: number;
        points: number;
        valueFils: Fils;
        applied: boolean;
      }
    | { usable: false; balance: number; reason: string }
    | null;
  emirate: Emirate | null;
  zoneName: string | null;
  settings: Pick<CartSettings, "vatRateBp" | "pricesIncludeVat" | "freeDeliveryThresholdFils">;
};

export function resolveCart(
  input: CartDetailsInput,
  products: StoreProduct[],
  availability: Availability,
  settings: CartSettings,
  coupon: CartCoupon | null = null,
  giveaways: StoreGiveaway[] = [],
): CartDetails {
  const byVariant = new Map(
    products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)),
  );

  // Stock is per variant: lines of the same variant (different options) share it.
  const used = new Map<string, number>();
  const lines = input.lines.map((line): CartDetailLine => {
    const found = byVariant.get(line.variantId);
    const key = keyOf(line);
    // A giveaway line: the real bottle, priced and customised by the giveaway that offers it.
    const giveaway = line.giveawayId ? giveaways.find((g) => g.id === line.giveawayId) : undefined;
    const item = giveaway?.items.find((i) => i.variantId === line.variantId);
    const match = line.giveawayId && !item ? undefined : found;
    if (!match) {
      return {
        key,
        variantId: line.variantId,
        options: line.options,
        giveawayId: line.giveawayId,
        optionsText: "",
        minQty: 1,
        requestedQty: line.qty,
        qty: 0,
        available: 0,
        status: "unavailable",
        product: null,
        variantLabel: "",
        hasVariants: false,
        unitPriceFils: 0,
        lineTotalFils: 0,
      };
    }
    const { product, variant } = match;
    const groups = giveaway ? giveaway.optionGroups : product.optionGroups;
    // Options the product no longer offers (or changed): the line can't be bought as it is.
    const optionsOk = optionsProblem(groups, line.options) === null;
    const available = optionsOk
      ? Math.max(0, (availability[variant.id] ?? 0) - (used.get(variant.id) ?? 0))
      : 0;
    const qty = Math.min(line.qty, available);
    used.set(variant.id, (used.get(variant.id) ?? 0) + qty);
    const status: CartLineStatus = !optionsOk
      ? "unavailable"
      : available === 0
        ? "sold_out"
        : qty < line.qty
          ? "clamped"
          : "ok";
    const unitPriceFils = unitPriceWithOptions(
      item ? item.priceFils : variant.priceFils,
      groups,
      line.options,
    );
    const optionsText = describeChoices(groups, line.options);
    return {
      key,
      variantId: line.variantId,
      options: line.options,
      giveawayId: line.giveawayId,
      optionsText: giveaway
        ? [giveaway.name, optionsText].filter(Boolean).join(" · ")
        : optionsText,
      minQty: giveaway ? giveaway.minOrderQty : product.minOrderQty,
      requestedQty: line.qty,
      qty,
      available,
      status,
      product: {
        slug: product.slug,
        name: product.name,
        categoryName: product.category.name,
        typeLabel: productTypeLabel(product.category),
        destinationName: product.destination?.name ?? null,
        image: product.images[0],
      },
      variantLabel: variant.label,
      hasVariants: product.variants.length > 1,
      unitPriceFils,
      lineTotalFils: unitPriceFils * qty,
    };
  });

  const zone = input.emirate ? settings.zones.find((z) => z.emirate === input.emirate) : undefined;
  const pricing = priceCart({
    lines: lines
      .filter((l) => l.qty > 0)
      .map((l) => ({ unitPriceFils: l.unitPriceFils, qty: l.qty })),
    vatRateBp: settings.vatRateBp,
    pricesIncludeVat: settings.pricesIncludeVat,
    deliveryFeeFils: zone ? zone.feeFils : null,
    freeDeliveryThresholdFils: settings.freeDeliveryThresholdFils,
    fulfilment: "delivery",
    discountFils: coupon && "discountFils" in coupon ? coupon.discountFils : 0,
    waiveDelivery: coupon && "freeDelivery" in coupon ? coupon.freeDelivery : false,
  });

  return {
    lines,
    pricing,
    coupon,
    emirate: zone ? zone.emirate : null,
    zoneName: zone?.name ?? null,
    settings: {
      vatRateBp: settings.vatRateBp,
      pricesIncludeVat: settings.pricesIncludeVat,
      freeDeliveryThresholdFils: settings.freeDeliveryThresholdFils,
    },
  };
}
