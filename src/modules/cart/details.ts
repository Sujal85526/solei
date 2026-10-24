import { productTypeLabel } from "@/modules/storefront/labels";
import type { Fils } from "@/lib/money";
import { priceCart, type CartPricing } from "@/modules/orders/pricing";
import type {
  Availability,
  CartSettings,
  StoreImage,
  StoreProduct,
} from "@/modules/storefront/types";
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
  variantId: string;
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
  giftCard?: CartGiftCard | null;
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
): CartDetails {
  const byVariant = new Map(
    products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)),
  );

  const lines = input.lines.map((line): CartDetailLine => {
    const match = byVariant.get(line.variantId);
    if (!match) {
      return {
        variantId: line.variantId,
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
    const available = Math.max(0, availability[variant.id] ?? 0);
    const qty = Math.min(line.qty, available);
    const status: CartLineStatus = available === 0 ? "sold_out" : qty < line.qty ? "clamped" : "ok";
    return {
      variantId: line.variantId,
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
      unitPriceFils: variant.priceFils,
      lineTotalFils: variant.priceFils * qty,
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
