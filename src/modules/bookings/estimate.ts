import type { BookingConfig, Estimate, EstimateLine, ProductInterest, QuoteLine } from "./types";

/**
 * Pricing for booking requests and quotes. Pure functions (integer fils, no floats) shared by the
 * wizard's running total and the admin quote builder. The stored estimate is always recomputed in
 * Postgres (`booking_estimate`) with the same rules — the client is never trusted with prices.
 */

export type EstimateSelection = {
  packageId?: string | null;
  flowers: boolean;
  flowerOptionId?: string | null;
  productsInterest: ProductInterest[];
};

/** Package base + flowers (base + colour surcharge) + products at their "from" price. */
export function computeEstimate(sel: EstimateSelection, config: BookingConfig): Estimate {
  const lines: EstimateLine[] = [];
  const pkg = sel.packageId ? config.packages.find((p) => p.id === sel.packageId) : undefined;
  if (pkg) {
    lines.push({
      kind: "package",
      label: pkg.name,
      qty: 1,
      unitPriceFils: pkg.basePriceFils,
      totalFils: pkg.basePriceFils,
    });
  }
  const flower = sel.flowers ? config.flowers.find((f) => f.id === sel.flowerOptionId) : undefined;
  if (flower) {
    const price = config.flowerBaseFils + flower.priceFils;
    lines.push({
      kind: "flowers",
      label: `Flowers — ${flower.name}`,
      qty: 1,
      unitPriceFils: price,
      totalFils: price,
    });
  }
  for (const item of sel.productsInterest) {
    if (!(item.qty > 0)) continue;
    const cat = config.products.find((p) => p.category === item.category);
    if (!cat) continue;
    lines.push({
      kind: "products",
      label: cat.name,
      category: cat.category,
      qty: item.qty,
      unitPriceFils: cat.fromPriceFils,
      totalFils: cat.fromPriceFils === null ? null : cat.fromPriceFils * item.qty,
    });
  }
  return { lines, totalFils: lines.reduce((s, l) => s + (l.totalFils ?? 0), 0) };
}

/** Lines without a price yet (e.g. dukhoon before launch) — "priced in your quotation". */
export function unpricedLines(estimate: Estimate) {
  return estimate.lines.filter((l) => l.totalFils === null);
}

/** Half-up a × bp / 10 000 for non-negative integers (matches the SQL default deposit). */
export function percentOf(amountFils: number, bp: number): number {
  return Math.floor((amountFils * bp * 2 + 10_000) / 20_000);
}

export type QuoteLineInput = { label: string; qty: number; unitPriceFils: number };

export type QuoteTotals = {
  lines: QuoteLine[];
  subtotalFils: number;
  discountFils: number;
  totalFils: number;
  depositFils: number;
  /** Validation problem to show in the builder (the RPC refuses the same cases). */
  error?: string;
};

/**
 * Quote totals: Σ qty × unit − discount; deposit defaults to `depositBp` of the total when not set.
 * Mirrors `send_booking_quote` so the builder shows exactly what will be sent.
 */
export function quoteTotals(
  input: QuoteLineInput[],
  discountFils: number,
  depositFils: number | null,
  depositBp: number,
): QuoteTotals {
  const lines = input.map((l) => ({ ...l, totalFils: l.qty * l.unitPriceFils }));
  const subtotalFils = lines.reduce((s, l) => s + l.totalFils, 0);
  const discount = Math.max(0, discountFils);
  const totalFils = Math.max(0, subtotalFils - discount);
  const deposit = depositFils ?? percentOf(totalFils, depositBp);
  let error: string | undefined;
  if (!lines.length) error = "Add at least one line.";
  else if (lines.some((l) => !l.label.trim())) error = "Every line needs a description.";
  else if (lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1))
    error = "Quantities must be whole numbers from 1.";
  else if (discount > subtotalFils) error = "The discount can't exceed the subtotal.";
  else if (deposit < 0 || deposit > totalFils)
    error = "The deposit must be between 0 and the total.";
  return { lines, subtotalFils, discountFils: discount, totalFils, depositFils: deposit, error };
}

/** Starting point for the first quote: the request's estimate, priced lines only. */
export function estimateToQuoteLines(estimate: Estimate): QuoteLineInput[] {
  return estimate.lines.map((l) => ({
    label: l.kind === "products" ? `${l.label} (giveaways)` : l.label,
    qty: l.qty,
    unitPriceFils: l.unitPriceFils ?? 0,
  }));
}
