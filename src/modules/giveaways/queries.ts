import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { must } from "@/lib/supabase/must";
import { createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { GiveawayItem, GiveawayOccasion, StoreGiveaway } from "./types";

/**
 * Giveaways read model: the occasions and the giveaway products with the real bottles they offer.
 * Public reads (RLS: active rows), cached under `catalog` like the rest of the shop.
 */

const isFallback = () => process.env.CONTENT_FALLBACK === "1";

const FALLBACK_IMAGE = "/images/products/perfumes-florals.jpg";

const giveawaySelect = `
  id, slug, name, description, min_order_qty, active,
  product_images (url, alt, sort),
  product_occasions (giveaway_occasions (slug, name, active, sort)),
  product_option_groups (id, name, kind, required, max_length, sort,
    product_options (id, label, price_delta_fils, active, sort, image_url)),
  giveaway_items (variant_id, price_fils, active, sort,
    product_variants (id, label, price_fils, active,
      products (slug, name, active,
        categories (slug, name),
        product_images (url, alt, sort))))
` as const;

function giveawayQuery() {
  return createPublicClient()
    .from("products")
    .select(giveawaySelect)
    .eq("is_giveaway", true)
    .eq("active", true)
    .order("sort")
    .order("name")
    .order("sort", { referencedTable: "product_images" });
}

type GiveawayRow = NonNullable<Awaited<ReturnType<typeof giveawayQuery>>["data"]>[number];

const bySort = <T extends { sort: number }>(rows: T[]) => [...rows].sort((a, b) => a.sort - b.sort);

function toStoreGiveaways(rows: GiveawayRow[]): StoreGiveaway[] {
  return rows.flatMap((p): StoreGiveaway[] => {
    const items = bySort(p.giveaway_items).flatMap((i): GiveawayItem[] => {
      const v = i.product_variants;
      const product = v?.products;
      // A bottle that is no longer sold (or its category hidden) quietly drops out.
      if (!i.active || !v?.active || !product?.active || !product.categories) return [];
      const cover = bySort(product.product_images)[0];
      return [
        {
          variantId: v.id,
          productSlug: product.slug,
          productName: product.name,
          variantLabel: v.label,
          type: { slug: product.categories.slug, name: product.categories.name },
          priceFils: i.price_fils ?? v.price_fils,
          image: cover ? { url: cover.url, alt: cover.alt } : { url: FALLBACK_IMAGE, alt: "" },
        },
      ];
    });
    if (!items.length) return [];
    return [
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? "",
        images: p.product_images.length
          ? p.product_images.map((i) => ({ url: i.url, alt: i.alt }))
          : [items[0].image],
        minOrderQty: p.min_order_qty,
        optionGroups: bySort(p.product_option_groups).map((g) => ({
          id: g.id,
          name: g.name,
          kind: g.kind,
          required: g.required,
          maxLength: g.max_length,
          options: bySort(g.product_options)
            .filter((o) => o.active)
            .map((o) => ({
              id: o.id,
              label: o.label,
              priceDeltaFils: o.price_delta_fils,
              imageUrl: o.image_url,
            })),
        })),
        items,
        occasions: p.product_occasions
          .flatMap((o) => (o.giveaway_occasions?.active ? [o.giveaway_occasions] : []))
          .sort((a, b) => a.sort - b.sort)
          .map((o) => ({ slug: o.slug, name: o.name })),
      },
    ];
  });
}

export async function listOccasions(): Promise<GiveawayOccasion[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return [];
  const rows = must(
    await createPublicClient()
      .from("giveaway_occasions")
      .select("id, slug, name, blurb, image_url")
      .eq("active", true)
      .order("sort")
      .order("name"),
    "giveaway_occasions",
  );
  return rows.map((o) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    blurb: o.blurb ?? "",
    image: o.image_url,
  }));
}

export async function listGiveaways(): Promise<StoreGiveaway[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return [];
  return toStoreGiveaways(must(await giveawayQuery(), "giveaways"));
}

export async function getGiveaway(slug: string): Promise<StoreGiveaway | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return null;
  const rows = must(await giveawayQuery().eq("slug", slug).limit(1), "giveaway");
  return toStoreGiveaways(rows)[0] ?? null;
}

/** Uncached: these giveaways with current prices and choices (for the cart and checkout). */
export async function fetchGiveaways(ids: string[]): Promise<StoreGiveaway[]> {
  if (!ids.length || isFallback()) return [];
  return toStoreGiveaways(must(await giveawayQuery().in("id", ids), "giveaways"));
}
