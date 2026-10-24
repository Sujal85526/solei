import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";

export async function listCategories() {
  const supabase = await createClient();
  return must(
    await supabase.from("categories").select("*").order("sort").order("name"),
    "categories",
  );
}

export async function listDestinations() {
  const supabase = await createClient();
  return must(
    await supabase.from("destinations").select("*").order("sort").order("name"),
    "destinations",
  );
}

export type AdminProductFilters = { q?: string; category?: string; status?: "active" | "inactive" };

export async function listProducts(filters: AdminProductFilters = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("products")
    .select(
      "id, name, slug, active, featured, sort, categories(id, name), destinations(id, name, accent_colour), product_variants(id, label, sku, price_fils, active), product_images(url, alt, sort)",
    )
    .order("sort")
    .order("name");
  if (filters.q) q = q.ilike("name", `%${filters.q}%`);
  if (filters.category) q = q.eq("category_id", filters.category);
  if (filters.status) q = q.eq("active", filters.status === "active");
  const [res, stock] = await Promise.all([q, onHandByVariant()]);
  const products = must(res, "products");
  return products.map((p) => ({
    ...p,
    product_images: [...p.product_images].sort((a, b) => a.sort - b.sort),
    onHand: p.product_variants.reduce((sum, v) => sum + (stock.get(v.id) ?? 0), 0),
  }));
}

export async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "*, product_variants(*, variant_costs(cost_fils)), product_images(id, url, alt, sort, storage_path), product_option_groups(id, name, kind, required, max_length, sort, product_options(id, label, price_delta_fils, active, sort))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    product_variants: [...data.product_variants].sort(
      (a, b) => a.sort - b.sort || a.sku.localeCompare(b.sku),
    ),
    product_images: [...data.product_images].sort((a, b) => a.sort - b.sort),
    product_option_groups: [...data.product_option_groups]
      .sort((a, b) => a.sort - b.sort)
      .map((g) => ({
        ...g,
        product_options: [...g.product_options].sort((a, b) => a.sort - b.sort),
      })),
  };
}

/** Total on hand per variant across all locations (RLS: needs inventory.view or pos.use). */
/**
 * On hand per variant across all locations, summed in the database. Needs no product ids, so
 * pages run it alongside their product query. Empty without stock permissions (RLS).
 */
export async function onHandByVariant() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("stock_on_hand_by_variant");
  return new Map((data ?? []).map((row) => [row.variant_id, row.on_hand]));
}
