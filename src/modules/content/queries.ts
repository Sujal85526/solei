import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { must } from "@/lib/supabase/must";
import { createPublicClient } from "@/lib/supabase/server";
import { getPublicProgramme } from "@/modules/loyalty/queries";
import { seedCategories, seedDestinations, seedEventTypes, seedPrices } from "./seed";

/**
 * Homepage read model — public, cached and tagged so admin edits can `revalidateTag`.
 * Falls back to the launch seed only when CONTENT_FALLBACK=1 (CI builds without a database).
 */

export const CONTENT_TAGS = {
  catalog: "catalog",
  settings: "settings",
  loyalty: "loyalty",
  /** Online availability (stock ledger); revalidate after sales, receipts and adjustments. */
  stock: "stock",
} as const;

export type HomeDestination = {
  slug: string;
  name: string;
  region: string;
  mood: string;
  image: string;
  categoryName: string;
  priceFils: number;
};

export type HomeContent = {
  destinations: HomeDestination[];
  collection: {
    slug: string;
    name: string;
    description: string;
    image: string;
    fromFils: number;
    count: number;
  }[];
  eventTypes: readonly string[];
  passport: {
    stampsForReward: number;
    rewardLabel: string;
    /** null = passports only on request. */
    issueAfterPurchases: number | null;
    enabled: boolean;
  };
  instagram: { handle: string; url: string };
};

/** Launch loyalty defaults — used only without a database (CONTENT_FALLBACK=1) or before a rule exists. */
const passportDefaults: HomeContent["passport"] = {
  stampsForReward: 12,
  rewardLabel: "a free all-over spray of your choice",
  issueAfterPurchases: 2,
  enabled: true,
};

const singular = (name: string) => name.replace(/s$/, "").replace(/ sprays$/, " spray");

export async function getHomeContent(): Promise<HomeContent> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog, CONTENT_TAGS.settings, CONTENT_TAGS.loyalty);

  if (process.env.CONTENT_FALLBACK === "1") return fallbackContent();

  const db = createPublicClient();
  const [destinationsRes, productsRes, categoriesRes, settingsRes, programme] = await Promise.all([
    db
      .from("destinations")
      .select("id, slug, name, region, mood, postcard_image_url")
      .order("sort"),
    db
      .from("products")
      .select("id, destination_id, category_id, product_variants(price_fils, active)")
      .order("sort"),
    db.from("categories").select("id, slug, name, description, image_url").order("sort"),
    db.from("settings").select("instagram_handle, instagram_url").single(),
    getPublicProgramme(),
  ]);
  const destinationRows = must(destinationsRes, "destinations");
  const productRows = must(productsRes, "products");
  const categoryRows = must(categoriesRes, "categories");
  const settings = must(settingsRes, "settings");

  const categories = new Map(categoryRows.map((c) => [c.id, c]));
  const minPrice = (variants: { price_fils: number; active: boolean }[]) =>
    Math.min(...variants.filter((v) => v.active).map((v) => v.price_fils));

  const destinations: HomeDestination[] = destinationRows.flatMap((d) => {
    const product = productRows.find((p) => p.destination_id === d.id && p.product_variants.length);
    if (!product) return [];
    const category = categories.get(product.category_id);
    return [
      {
        slug: d.slug,
        name: d.name,
        region: d.region ?? "",
        mood: d.mood ?? "",
        image: d.postcard_image_url ?? "/images/brand/hero-sprays-arch.jpg",
        categoryName: category ? singular(category.name) : "",
        priceFils: minPrice(product.product_variants),
      },
    ];
  });

  const collection = categoryRows.flatMap((c) => {
    const products = productRows.filter((p) => p.category_id === c.id && p.product_variants.length);
    if (!products.length || !c.image_url) return [];
    return [
      {
        slug: c.slug,
        name: c.name,
        description: c.description ?? "",
        image: c.image_url,
        fromFils: Math.min(...products.map((p) => minPrice(p.product_variants))),
        count: products.length,
      },
    ];
  });

  return {
    destinations,
    collection,
    eventTypes: seedEventTypes,
    passport: programme.rule
      ? {
          stampsForReward: programme.rule.stampsForReward,
          rewardLabel: programme.rule.rewardLabel,
          issueAfterPurchases: programme.rule.issuePassportAfterPurchases,
          enabled: programme.enabled,
        }
      : passportDefaults,
    instagram: {
      handle: settings.instagram_handle ?? "@solei.ad",
      url: settings.instagram_url ?? "https://www.instagram.com/solei.ad/",
    },
  };
}

function fallbackContent(): HomeContent {
  const categoryName = (slug: string) => seedCategories.find((c) => c.slug === slug)?.name ?? slug;
  return {
    destinations: seedDestinations.map((d) => ({
      slug: d.slug,
      name: d.name,
      region: d.region,
      mood: d.mood,
      image: d.image,
      categoryName: singular(categoryName(d.category)),
      priceFils: seedPrices[d.category],
    })),
    collection: seedCategories
      .filter((c) => c.image)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        description: c.description,
        image: c.image as string,
        fromFils: seedPrices[c.slug as keyof typeof seedPrices],
        count: seedDestinations.filter((d) => d.category === c.slug).length,
      })),
    eventTypes: seedEventTypes,
    passport: passportDefaults,
    instagram: { handle: "@solei.ad", url: "https://www.instagram.com/solei.ad/" },
  };
}
