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
  const products = must(await q, "products");
  const variantIds = products.flatMap((p) => p.product_variants.map((v) => v.id));
  const stock = await onHandByVariant(variantIds);
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
      "*, product_variants(*, variant_costs(cost_fils)), product_images(id, url, alt, sort, storage_path)",
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
  };
}

/** Total on hand per variant across all locations (RLS: needs inventory.view or pos.use). */
export async function onHandByVariant(variantIds: string[]) {
  const map = new Map<string, number>();
  if (!variantIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_levels")
    .select("variant_id, on_hand")
    .in("variant_id", variantIds);
  for (const row of data ?? []) {
    if (!row.variant_id) continue;
    map.set(row.variant_id, (map.get(row.variant_id) ?? 0) + (row.on_hand ?? 0));
  }
  return map;
}
