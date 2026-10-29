import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Admin reads for giveaways (RLS: catalog.view). */

export type AdminOccasion = {
  id: string;
  name: string;
  slug: string;
  blurb: string | null;
  image_url: string | null;
  storage_path: string | null;
  active: boolean;
  sort: number;
};

export async function listOccasionsAdmin(): Promise<AdminOccasion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("giveaway_occasions")
    .select("id, name, slug, blurb, image_url, storage_path, active, sort")
    .order("sort")
    .order("name");
  return data ?? [];
}

/** A bottle a giveaway can offer: a variant of another product. */
export type BottleOption = {
  variantId: string;
  label: string;
  category: string;
  priceFils: number;
  active: boolean;
};

/** Every variant of the ordinary (non-giveaway) products, by category then name. */
export async function listBottles(): Promise<BottleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select(
      "id, label, price_fils, active, products!inner(name, active, is_giveaway, categories(name))",
    )
    .eq("products.is_giveaway", false)
    .order("sort");
  return (data ?? [])
    .map((v) => ({
      variantId: v.id,
      label: [v.products.name, v.label].filter(Boolean).join(" · "),
      category: v.products.categories?.name ?? "",
      priceFils: v.price_fils,
      active: v.active && v.products.active,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

export type GiveawaySettings = {
  isGiveaway: boolean;
  occasionIds: string[];
  items: { variantId: string; priceFils: number | null; active: boolean }[];
};

export async function getGiveawaySettings(productId: string): Promise<GiveawaySettings> {
  const supabase = await createClient();
  const [product, occasions, items] = await Promise.all([
    supabase.from("products").select("is_giveaway").eq("id", productId).maybeSingle(),
    supabase.from("product_occasions").select("occasion_id").eq("product_id", productId),
    supabase
      .from("giveaway_items")
      .select("variant_id, price_fils, active, sort")
      .eq("product_id", productId)
      .order("sort"),
  ]);
  return {
    isGiveaway: product.data?.is_giveaway ?? false,
    occasionIds: (occasions.data ?? []).map((o) => o.occasion_id),
    items: (items.data ?? []).map((i) => ({
      variantId: i.variant_id,
      priceFils: i.price_fils,
      active: i.active,
    })),
  };
}
