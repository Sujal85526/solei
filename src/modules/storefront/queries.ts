import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { must } from "@/lib/supabase/must";
import { createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import {
  fallbackCartSettings,
  fallbackCategories,
  fallbackDestinations,
  fallbackProducts,
  fallbackStock,
} from "./fallback";
import type {
  Availability,
  CartSettings,
  StoreCategory,
  StoreDestination,
  StoreProduct,
} from "./types";

/**
 * Storefront read model. Catalog reads are public (RLS: active rows only), cached for hours and
 * tagged `catalog` so admin edits can `revalidateTag`. Availability is cached separately for
 * minutes under `stock` and must be rendered inside <Suspense>.
 */

const isFallback = () => process.env.CONTENT_FALLBACK === "1";

const FALLBACK_IMAGE = "/images/brand/hero-sprays-arch.jpg";

const productSelect = `
  id, slug, name, description, notes_top, notes_heart, notes_base, featured, sort,
  category:categories (slug, name),
  destination:destinations (slug, name, region, mood, accent_colour),
  product_images (url, alt, sort),
  product_variants (id, label, size_ml, sku, price_fils, active, sort),
  min_order_qty, launch_at,
  product_option_groups (id, name, kind, required, max_length, sort,
    product_options (id, label, price_delta_fils, active, sort, image_url))
` as const;

function productQuery() {
  return createPublicClient()
    .from("products")
    .select(productSelect)
    .order("sort")
    .order("name")
    .order("sort", { referencedTable: "product_images" })
    .order("sort", { referencedTable: "product_variants" });
}

type ProductRow = NonNullable<Awaited<ReturnType<typeof productQuery>>["data"]>[number];

function toStoreProducts(rows: ProductRow[]): StoreProduct[] {
  return rows.flatMap((p): StoreProduct[] => {
    const variants = p.product_variants
      .filter((v) => v.active)
      .map((v) => ({
        id: v.id,
        label: v.label,
        sizeMl: v.size_ml,
        sku: v.sku,
        priceFils: v.price_fils,
      }));
    // Hidden category (inactive) or nothing to sell → not on the storefront.
    if (!p.category || !variants.length) return [];
    return [
      {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description ?? "",
        notes: { top: p.notes_top, heart: p.notes_heart, base: p.notes_base },
        featured: p.featured,
        category: { slug: p.category.slug, name: p.category.name },
        destination: p.destination
          ? {
              slug: p.destination.slug,
              name: p.destination.name,
              region: p.destination.region ?? "",
              mood: p.destination.mood ?? "",
              accent: p.destination.accent_colour,
            }
          : null,
        images: p.product_images.length
          ? p.product_images.map((i) => ({ url: i.url, alt: i.alt }))
          : [{ url: FALLBACK_IMAGE, alt: "" }],
        variants,
        optionGroups: [...(p.product_option_groups ?? [])]
          .sort((a, b) => a.sort - b.sort)
          .map((g) => ({
            id: g.id,
            name: g.name,
            kind: g.kind,
            required: g.required,
            maxLength: g.max_length,
            options: [...g.product_options]
              .filter((o) => o.active)
              .sort((a, b) => a.sort - b.sort)
              .map((o) => ({
                id: o.id,
                label: o.label,
                priceDeltaFils: o.price_delta_fils,
                imageUrl: o.image_url,
              })),
          })),
        minOrderQty: p.min_order_qty ?? 1,
        // Not launched yet: only early-access tiers can buy it (the order RPC checks).
        earlyAccessUntil: p.launch_at && new Date(p.launch_at) > new Date() ? p.launch_at : null,
      },
    ];
  });
}

export async function listProducts(): Promise<StoreProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return fallbackProducts();
  // Products before their launch stay off the shop (early-access customers get the link); the
  // listing refreshes hourly, so a launch shows within the hour.
  return toStoreProducts(must(await productQuery(), "products")).filter((p) => !p.earlyAccessUntil);
}

/** One product by slug (its own cache entry, so a newly published product resolves at once). */
export async function getProduct(slug: string): Promise<StoreProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return fallbackProducts().find((p) => p.slug === slug) ?? null;
  const rows = must(await productQuery().eq("slug", slug).limit(1), "product");
  return toStoreProducts(rows)[0] ?? null;
}

/** Uncached: the products owning these variants, with current prices (for the cart). */
export async function fetchProductsForVariants(variantIds: string[]): Promise<StoreProduct[]> {
  if (!variantIds.length) return [];
  if (isFallback()) {
    return fallbackProducts().filter((p) => p.variants.some((v) => variantIds.includes(v.id)));
  }
  const db = createPublicClient();
  const variants = must(
    await db.from("product_variants").select("product_id").in("id", variantIds),
    "product_variants",
  );
  const productIds = [...new Set(variants.map((v) => v.product_id))];
  if (!productIds.length) return [];
  return toStoreProducts(must(await productQuery().in("id", productIds), "products"));
}

/** Other products from the same category first, then the rest of the collection. */
export async function getRelatedProducts(slug: string, limit = 4): Promise<StoreProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);
  const products = await listProducts();
  const self = products.find((p) => p.slug === slug);
  const others = products.filter((p) => p.slug !== slug);
  const same = others.filter((p) => p.category.slug === self?.category.slug);
  const rest = others.filter((p) => p.category.slug !== self?.category.slug);
  return [...same, ...rest].slice(0, limit);
}

export async function listCategories(): Promise<StoreCategory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  const products = await listProducts();
  if (isFallback()) return fallbackCategories(products);

  const rows = must(
    await createPublicClient()
      .from("categories")
      .select("slug, name, description, image_url")
      .order("sort"),
    "categories",
  );
  return rows.map((c) => {
    const inCategory = products.filter((p) => p.category.slug === c.slug);
    const prices = inCategory.flatMap((p) => p.variants.map((v) => v.priceFils));
    return {
      slug: c.slug,
      name: c.name,
      description: c.description ?? "",
      image: c.image_url,
      productCount: inCategory.length,
      fromFils: prices.length ? Math.min(...prices) : null,
    };
  });
}

export async function getCategory(slug: string): Promise<StoreCategory | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}

export async function listDestinations(): Promise<StoreDestination[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);

  if (isFallback()) return fallbackDestinations();

  const rows = must(
    await createPublicClient()
      .from("destinations")
      .select(
        "slug, name, country, region, mood, story, hero_image_url, postcard_image_url, accent_colour",
      )
      .order("sort"),
    "destinations",
  );
  return rows.map((d) => ({
    slug: d.slug,
    name: d.name,
    country: d.country ?? "",
    region: d.region ?? "",
    mood: d.mood ?? "",
    story: d.story ?? "",
    accent: d.accent_colour,
    heroImage: d.hero_image_url ?? d.postcard_image_url ?? FALLBACK_IMAGE,
    postcardImage: d.postcard_image_url ?? d.hero_image_url ?? FALLBACK_IMAGE,
  }));
}

export async function getDestination(
  slug: string,
): Promise<{ destination: StoreDestination; products: StoreProduct[] } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.catalog);
  const [destinations, products] = await Promise.all([listDestinations(), listProducts()]);
  const destination = destinations.find((d) => d.slug === slug);
  if (!destination) return null;
  return { destination, products: products.filter((p) => p.destination?.slug === slug) };
}

/** VAT + delivery settings for the cart estimate. */
export async function getCartSettings(): Promise<CartSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.settings);

  if (isFallback()) return fallbackCartSettings();

  const db = createPublicClient();
  const [settingsRes, zonesRes] = await Promise.all([
    db
      .from("settings")
      .select("vat_rate_bp, prices_include_vat, free_delivery_threshold_fils")
      .single(),
    db.from("delivery_zones").select("emirate, name, fee_fils").eq("active", true).order("sort"),
  ]);
  const settings = must(settingsRes, "settings");
  const zones = must(zonesRes, "delivery_zones");
  return {
    vatRateBp: settings.vat_rate_bp,
    pricesIncludeVat: settings.prices_include_vat,
    freeDeliveryThresholdFils: settings.free_delivery_threshold_fils,
    zones: zones.map((z) => ({ emirate: z.emirate, name: z.name, feeFils: z.fee_fils })),
  };
}

/** Live (uncached) online availability — for server actions that must not oversell. */
export async function fetchAvailability(variantIds: string[]): Promise<Availability> {
  if (!variantIds.length) return {};
  if (isFallback()) return Object.fromEntries(variantIds.map((id) => [id, fallbackStock]));
  const rows = must(
    await createPublicClient().rpc("online_availability", { p_variant_ids: variantIds }),
    "online_availability",
  );
  return Object.fromEntries(rows.map((r) => [r.variant_id, Math.max(0, r.available)]));
}

/**
 * Cached online availability for display (cards, product page). Short-lived and tagged `stock`;
 * render inside <Suspense>. Pass ids sorted for a stable cache key.
 */
export async function getAvailability(variantIds: string[]): Promise<Availability> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAGS.stock);
  return fetchAvailability(variantIds);
}

/** Convenience: availability for every variant of the given products. */
export function availabilityFor(products: StoreProduct[]): Promise<Availability> {
  const ids = [...new Set(products.flatMap((p) => p.variants.map((v) => v.id)))].sort();
  return getAvailability(ids);
}
