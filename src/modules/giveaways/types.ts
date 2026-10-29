import type { Fils } from "@/lib/money";
import type { OptionGroup } from "@/modules/catalog/options";
import type { StoreImage } from "@/modules/storefront/types";

/** Giveaways read models (public, serialisable — safe to pass to client components). */

export type GiveawayOccasion = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  image: string | null;
};

/** A real bottle a giveaway offers (a variant of a catalog product), at its giveaway price. */
export type GiveawayItem = {
  variantId: string;
  productSlug: string;
  /** The scent, e.g. "Capri". */
  productName: string;
  variantLabel: string;
  /** Product type, from the bottle's category ("Perfume", "All over spray"). */
  type: { slug: string; name: string };
  priceFils: Fils;
  image: StoreImage;
};

export type StoreGiveaway = {
  id: string;
  slug: string;
  name: string;
  description: string;
  images: StoreImage[];
  /** Fewest pieces per order, across all its bottles. */
  minOrderQty: number;
  /** Packaging, designs, personalisation (the giveaway product's own choices). */
  optionGroups: OptionGroup[];
  items: GiveawayItem[];
  occasions: { slug: string; name: string }[];
};
