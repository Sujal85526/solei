import { formatAED } from "@/lib/money";
import { describeSnapshot, type OptionsSnapshot } from "@/modules/catalog/options";

export type FormattableLine = {
  product_name: string;
  variant_label: string | null;
  qty: number;
  line_total_fils: number;
  is_reward?: boolean | null;
  /** Giveaways: what the customer chose (order_lines.options). */
  options?: unknown;
};

/** "2 × Capri Perfume · 50 ml — AED 560" (one line per order line) for emails and summaries. */
export function formatOrderLine(l: FormattableLine): string {
  const opts = describeSnapshot(l.options as OptionsSnapshot | null | undefined);
  const name = [l.product_name, l.variant_label, opts].filter(Boolean).join(" · ");
  const price = l.is_reward ? "Reward" : formatAED(l.line_total_fils);
  return `${l.qty} × ${name} — ${price}`;
}

export function formatOrderLines(lines: FormattableLine[]): string {
  return lines.map(formatOrderLine).join("\n");
}

/** Tracking sentence for the dispatched email; empty when there is nothing to track. */
export function trackingText(trackingNumber?: string | null, courier?: string | null): string {
  const no = trackingNumber?.trim();
  const by = courier?.trim();
  if (no && by) return `Courier: ${by} · Tracking number: ${no}`;
  if (no) return `Tracking number: ${no}`;
  if (by) return `Courier: ${by}`;
  return "";
}

/** "abu_dhabi" → "Abu Dhabi". */
export function humanize(key: string | null | undefined): string {
  if (!key) return "";
  return key
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Unit profit and margin (basis points) of a line; null when the cost isn't known. */
export function lineProfit(
  unitPriceFils: number,
  unitCostFils: number | null | undefined,
  qty: number,
): { profitFils: number; marginBp: number | null } | null {
  if (unitCostFils === null || unitCostFils === undefined) return null;
  const profitFils = (unitPriceFils - unitCostFils) * qty;
  const revenue = unitPriceFils * qty;
  return {
    profitFils,
    marginBp: revenue > 0 ? Math.round((profitFils * 10_000) / revenue) : null,
  };
}
