import {
  seedCategories,
  seedDestinations,
  seedInitialStock,
  seedPrices,
  seedSizes,
} from "@/modules/content/seed";
import type { CartSettings, StoreCategory, StoreDestination, StoreProduct } from "./types";

/**
 * Launch catalogue built from the seed — only used when CONTENT_FALLBACK=1 (CI builds without a
 * database). Variant ids are deterministic placeholders.
 */

const fakeId = (i: number) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;

export function fallbackDestinations(): StoreDestination[] {
  return seedDestinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    region: d.region,
    mood: d.mood,
    accent: d.accent,
    country: d.country,
    story: d.story,
    heroImage: d.image,
    postcardImage: d.image,
  }));
}

export function fallbackProducts(): StoreProduct[] {
  return seedDestinations.map((d, i) => {
    const category = seedCategories.find((c) => c.slug === d.category)!;
    const kind = d.category === "perfume" ? "Perfume" : "All-over spray";
    const size = seedSizes[d.category];
    return {
      id: fakeId(100 + i),
      slug: `${d.slug}-${d.category === "perfume" ? "perfume" : "all-over-spray"}`,
      name: `${d.name} ${kind}`,
      description: d.story,
      notes: { top: [], heart: [], base: [] },
      featured: true,
      category: { slug: category.slug, name: category.name },
      destination: {
        slug: d.slug,
        name: d.name,
        region: d.region,
        mood: d.mood,
        accent: d.accent,
      },
      images: [
        { url: d.image, alt: `${d.name} — ${d.mood}` },
        ...(category.image ? [{ url: category.image, alt: `Solei ${category.name}` }] : []),
      ],
      variants: [
        {
          id: fakeId(i),
          label: `${size} ml`,
          sizeMl: size,
          sku: `SOL-${d.slug.slice(0, 3).toUpperCase()}-${size}`,
          priceFils: seedPrices[d.category],
        },
      ],
      optionGroups: [],
      minOrderQty: 1,
    };
  });
}

export function fallbackCategories(products: StoreProduct[]): StoreCategory[] {
  return seedCategories.map((c) => {
    const inCategory = products.filter((p) => p.category.slug === c.slug);
    return {
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: c.image,
      productCount: inCategory.length,
      fromFils: inCategory.length
        ? Math.min(...inCategory.flatMap((p) => p.variants.map((v) => v.priceFils)))
        : null,
    };
  });
}

export function fallbackCartSettings(): CartSettings {
  return { vatRateBp: 500, pricesIncludeVat: true, freeDeliveryThresholdFils: null, zones: [] };
}

export const fallbackStock = seedInitialStock;
