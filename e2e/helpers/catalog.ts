import { adminClient } from "./auth";

export type TestProduct = {
  productId: string;
  variantId: string;
  sku: string;
  slug: string;
  name: string;
  priceFils: number;
  destination: { id: string; name: string } | null;
};

/**
 * A product of the test's own, so specs don't depend on which catalogue the test database holds
 * (demo seed or a copy of the live shop). Active, one 50 ml variant, stock at the main location.
 * A fresh slug is never in the storefront's cached catalogue, so its product page reads it straight
 * from the database; it won't show in cached listings (shop, homepage) until the cache refreshes.
 */
export async function createTestProduct(
  tag: string,
  opts: {
    name?: string;
    priceFils?: number;
    stock?: number;
    category?: string;
    destination?: boolean;
    minOrderQty?: number;
  } = {},
): Promise<TestProduct> {
  const admin = adminClient();
  const stamp = `${tag}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const priceFils = opts.priceFils ?? 28_000;
  const { data: categories } = await admin
    .from("categories")
    .select("id, slug")
    .order("sort", { ascending: true });
  const category =
    categories?.find((c) => c.slug === (opts.category ?? "perfume")) ?? categories?.[0];
  if (!category) throw new Error("no categories in the test database");

  let destination: TestProduct["destination"] = null;
  if (opts.destination) {
    // Inactive, so it doesn't appear on the storefront for others; stamps still carry it.
    const name = `E2E Dest ${stamp}`;
    const { data, error } = await admin
      .from("destinations")
      .insert({ slug: `e2e-${stamp}`, name, active: false, sort: 999 })
      .select("id")
      .single();
    if (error) throw error;
    destination = { id: data.id, name };
  }

  const name = opts.name ?? `E2E Product ${stamp}`;
  const slug = `e2e-${stamp}`;
  const { data: product, error } = await admin
    .from("products")
    .insert({
      slug,
      name,
      category_id: category.id,
      destination_id: destination?.id ?? null,
      active: true,
      ...(opts.minOrderQty ? { min_order_qty: opts.minOrderQty } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  const sku = `E2E-${stamp}`.toUpperCase();
  const { data: variant, error: e2 } = await admin
    .from("product_variants")
    .insert({ product_id: product.id, sku, label: "50 ml", price_fils: priceFils, active: true })
    .select("id")
    .single();
  if (e2) throw e2;
  const stock = opts.stock ?? 50;
  if (stock) {
    const { data: location } = await admin
      .from("stock_locations")
      .select("id")
      .eq("is_default", true)
      .single();
    const { error: e3 } = await admin.from("stock_movements").insert({
      variant_id: variant.id,
      location_id: location!.id,
      qty: stock,
      type: "receive",
      reason: "e2e",
    });
    if (e3) throw e3;
  }
  return { productId: product.id, variantId: variant.id, sku, slug, name, priceFils, destination };
}
