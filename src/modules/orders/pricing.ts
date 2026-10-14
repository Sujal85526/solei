import {
  assertFils,
  vatFromInclusive,
  vatOnExclusive,
  type BasisPoints,
  type Fils,
} from "@/lib/money";

/**
 * Pure cart / order pricing. Shared by the storefront cart, checkout and the event POS so every
 * channel prices an order identically. All amounts are integer fils; no floats anywhere.
 *
 * Rules:
 * - Reward lines (loyalty redemptions) are free: they add nothing to the subtotal.
 * - Delivery is free for pickup, or when the goods subtotal reaches the free-delivery threshold.
 * - VAT applies to goods + delivery. With `pricesIncludeVat` the VAT is contained in the amounts
 *   (total = subtotal + delivery); otherwise it is added on top. VAT is computed once on the
 *   taxable total (not per line) and rounded half-up.
 */

export type Fulfilment = "delivery" | "pickup";

export type PricingLine = {
  unitPriceFils: Fils;
  qty: number;
  /** Loyalty reward redemption — priced at zero. */
  isReward?: boolean;
};

export type PriceCartInput = {
  lines: PricingLine[];
  vatRateBp: BasisPoints;
  pricesIncludeVat: boolean;
  /** Fee for the chosen delivery zone; `null` while the zone is not chosen yet. */
  deliveryFeeFils: Fils | null;
  /** Goods subtotal from which delivery is free; `null` = no free delivery. */
  freeDeliveryThresholdFils: Fils | null;
  fulfilment: Fulfilment;
};

export type PricedLine = PricingLine & { lineTotalFils: Fils };

export type CartPricing = {
  lines: PricedLine[];
  /** Number of units, rewards included. */
  itemCount: number;
  /** Goods total as displayed (inclusive or exclusive of VAT per settings). */
  subtotalFils: Fils;
  /** Delivery charged; `null` when delivery is pending a zone choice. */
  deliveryFeeFils: Fils | null;
  /** True when the threshold waived a delivery fee (or would, once a zone is chosen). */
  freeDelivery: boolean;
  /** How much more goods would unlock free delivery; `null` when not applicable. */
  amountToFreeDeliveryFils: Fils | null;
  vatFils: Fils;
  /** Whether `vatFils` is contained in the total (inclusive) or added to it. */
  vatIncluded: boolean;
  totalFils: Fils;
};

function assertQty(qty: number) {
  if (!Number.isSafeInteger(qty) || qty < 1) throw new Error(`Quantity must be a positive integer`);
}

function assertNonNegative(value: number, what: string) {
  assertFils(value);
  if (value < 0) throw new Error(`${what} must not be negative`);
}

export function priceCart(input: PriceCartInput): CartPricing {
  const { vatRateBp, pricesIncludeVat, fulfilment } = input;
  if (!Number.isSafeInteger(vatRateBp) || vatRateBp < 0 || vatRateBp > 10_000) {
    throw new Error(`VAT rate must be 0–10000 basis points`);
  }

  const lines = input.lines.map((line): PricedLine => {
    assertNonNegative(line.unitPriceFils, "Unit price");
    assertQty(line.qty);
    const lineTotalFils = line.isReward ? 0 : line.unitPriceFils * line.qty;
    assertFils(lineTotalFils);
    return { ...line, lineTotalFils };
  });

  const subtotalFils = lines.reduce((sum, l) => sum + l.lineTotalFils, 0);
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0);

  const threshold = input.freeDeliveryThresholdFils;
  if (threshold !== null) assertNonNegative(threshold, "Free-delivery threshold");
  if (input.deliveryFeeFils !== null) assertNonNegative(input.deliveryFeeFils, "Delivery fee");

  const reachesThreshold = threshold !== null && subtotalFils >= threshold;
  const isPickup = fulfilment === "pickup";
  const empty = lines.length === 0;

  let deliveryFeeFils: Fils | null;
  if (isPickup || empty || reachesThreshold) deliveryFeeFils = 0;
  else deliveryFeeFils = input.deliveryFeeFils;

  const freeDelivery = !isPickup && !empty && reachesThreshold;
  const amountToFreeDeliveryFils =
    isPickup || empty || threshold === null || reachesThreshold ? null : threshold - subtotalFils;

  const taxable = subtotalFils + (deliveryFeeFils ?? 0);
  const vatFils = pricesIncludeVat
    ? vatFromInclusive(taxable, vatRateBp)
    : vatOnExclusive(taxable, vatRateBp);
  const totalFils = pricesIncludeVat ? taxable : taxable + vatFils;

  return {
    lines,
    itemCount,
    subtotalFils,
    deliveryFeeFils,
    freeDelivery,
    amountToFreeDeliveryFils,
    vatFils,
    vatIncluded: pricesIncludeVat,
    totalFils,
  };
}

/** Progress (0–1) towards the free-delivery threshold, for a progress bar. Display only. */
export function freeDeliveryProgress(subtotalFils: Fils, thresholdFils: Fils | null): number {
  if (thresholdFils === null || thresholdFils <= 0) return 1;
  return Math.min(1, subtotalFils / thresholdFils);
}
