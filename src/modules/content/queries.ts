import "server-only";
import { seedCategories, seedDestinations, seedEventTypes, seedPrices } from "./seed";

/**
 * Homepage read model. Reads from the static launch content for now; `feat/schema-core`
 * switches these to the database (destinations, products, loyalty settings, site settings).
 */

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
    issueAfterPurchases: number;
    enabled: boolean;
  };
  instagram: { handle: string; url: string };
};

export async function getHomeContent(): Promise<HomeContent> {
  const categoryName = (slug: string) => seedCategories.find((c) => c.slug === slug)?.name ?? slug;
  const destinations = seedDestinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    region: d.region,
    mood: d.mood,
    image: d.image,
    categoryName: categoryName(d.category).replace(/s$/, ""),
    priceFils: seedPrices[d.category],
  }));
  const collection = seedCategories
    .filter((c) => c.image)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      image: c.image as string,
      fromFils: seedPrices[c.slug as keyof typeof seedPrices],
      count: seedDestinations.filter((d) => d.category === c.slug).length,
    }));
  return {
    destinations,
    collection,
    eventTypes: seedEventTypes,
    passport: {
      stampsForReward: 12,
      rewardLabel: "a free all-over spray of your choice",
      issueAfterPurchases: 2,
      enabled: true,
    },
    instagram: { handle: "@solei.ad", url: "https://www.instagram.com/solei.ad/" },
  };
}
