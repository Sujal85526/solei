import type { Fils } from "@/lib/money";
import {
  optionsProblem,
  unitPriceWithOptions,
  type LineOptions,
  type OptionGroup,
} from "@/modules/catalog/options";
import type { GiveawayItem, StoreGiveaway } from "./types";

/**
 * The guided giveaway flow (product type → scent → packaging → quantity → personalisation), pure.
 * Shared by the giveaway page, the cart, the till and staff orders; the database prices and checks
 * every line again (`line_unit_price_fils` / `line_options_check` with the giveaway).
 */

/** Product types the giveaway offers (perfume, all-over spray …), in the owner's order. */
export function giveawayTypes(items: GiveawayItem[]): GiveawayItem["type"][] {
  const seen = new Map<string, GiveawayItem["type"]>();
  for (const i of items) if (!seen.has(i.type.slug)) seen.set(i.type.slug, i.type);
  return [...seen.values()];
}

export const itemsOfType = (items: GiveawayItem[], typeSlug: string | null) =>
  typeSlug ? items.filter((i) => i.type.slug === typeSlug) : items;

/** Choice groups shown as their own step: pick-from-a-list ones (packaging, designs …). */
export const choiceGroups = (groups: OptionGroup[]) => groups.filter((g) => g.kind !== "text");
/** …and the written ones (names on the tag, special requests), on the personalisation step. */
export const textGroups = (groups: OptionGroup[]) => groups.filter((g) => g.kind === "text");

/** One piece: the bottle's giveaway price plus the chosen options. */
export function giveawayUnitPrice(
  giveaway: Pick<StoreGiveaway, "items" | "optionGroups">,
  variantId: string,
  choices: LineOptions | undefined,
): Fils | null {
  const item = giveaway.items.find((i) => i.variantId === variantId);
  return item ? unitPriceWithOptions(item.priceFils, giveaway.optionGroups, choices) : null;
}

/** "From AED x" on cards: the cheapest bottle (choices that cost extra are added later). */
export const giveawayFromFils = (giveaway: Pick<StoreGiveaway, "items">): Fils =>
  Math.min(...giveaway.items.map((i) => i.priceFils));

/** First thing missing before the giveaway can go in the bag, in customer words, or null. */
export function giveawayProblem(
  giveaway: Pick<StoreGiveaway, "items" | "optionGroups" | "minOrderQty">,
  variantId: string | null,
  choices: LineOptions | undefined,
  qty: number,
): string | null {
  if (!variantId || !giveaway.items.some((i) => i.variantId === variantId))
    return "Please choose a scent.";
  const options = optionsProblem(giveaway.optionGroups, choices);
  if (options) return options;
  if (!Number.isInteger(qty) || qty < giveaway.minOrderQty)
    return `The minimum is ${giveaway.minOrderQty} pieces.`;
  return null;
}

/** Occasion filter on the giveaways page (no occasion = everything). */
export const giveawaysFor = (giveaways: StoreGiveaway[], occasion: string | null | undefined) =>
  occasion ? giveaways.filter((g) => g.occasions.some((o) => o.slug === occasion)) : giveaways;
