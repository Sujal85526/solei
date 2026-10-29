import type { Fils } from "@/lib/money";
import type { Emirate } from "@/modules/cart/schema";
import type { OptionGroup } from "@/modules/catalog/options";

/** Storefront read models (public, serialisable — safe to pass to client components). */

export type StoreImage = { url: string; alt: string };

export type StoreVariant = {
  id: string;
  label: string;
  sizeMl: number | null;
  sku: string;
  priceFils: Fils;
};

export type StoreDestinationRef = {
  slug: string;
  name: string;
  region: string;
  mood: string;
  accent: string | null;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  featured: boolean;
  category: { slug: string; name: string };
  destination: StoreDestinationRef | null;
  images: StoreImage[];
  /** Active variants, sorted; always at least one. */
  variants: StoreVariant[];
  /** Giveaways: choices the customer makes (empty for ordinary products). */
  optionGroups: OptionGroup[];
  /** Fewest pieces per order (1 for ordinary products). */
  minOrderQty: number;
  /** Before its launch: when it opens to everyone (until then early-access tiers only). */
  earlyAccessUntil?: string | null;
};

export type StoreCategory = {
  slug: string;
  name: string;
  description: string;
  image: string | null;
  productCount: number;
  fromFils: Fils | null;
};

export type StoreDestination = StoreDestinationRef & {
  country: string;
  story: string;
  heroImage: string;
  postcardImage: string;
};

export type DeliveryZone = { emirate: Emirate; name: string; feeFils: Fils };

export type CartSettings = {
  vatRateBp: number;
  pricesIncludeVat: boolean;
  freeDeliveryThresholdFils: Fils | null;
  zones: DeliveryZone[];
};

/** variantId → units available to sell online. */
export type Availability = Record<string, number>;
