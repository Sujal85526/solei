import { expect, type Page } from "@playwright/test";
import { adminClient } from "./auth";
import { createTestProduct, type TestProduct } from "./catalog";

export type TestGiveaway = {
  id: string;
  slug: string;
  name: string;
  occasion: { id: string; slug: string; name: string };
  /** Bottle offered at a giveaway price of AED 25 (first product type). */
  perfume: TestProduct;
  /** A second bottle of another product type, at its own price. */
  spray: TestProduct;
  typeNames: [string, string];
};

/**
 * A giveaway of the test's own: an occasion, a giveaway product (min. 20 pieces) offering two real
 * bottles of two product types, a "Packaging" choice with photo tiles (Gold box +AED 5) and a
 * required "Names on the tag" text. Everything is inserted before any page reads it, so the
 * per-slug page is fresh; cached lists (/giveaways, the till) need `refreshCatalogue`.
 */
export async function createTestGiveaway(tag: string): Promise<TestGiveaway> {
  const admin = adminClient();
  const stamp = `${tag}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const { data: categories } = await admin
    .from("categories")
    .select("slug, name")
    .order("sort", { ascending: true })
    .limit(2);
  if (!categories || categories.length < 2) throw new Error("need two categories");
  const perfume = await createTestProduct(`gw-a-${tag}`, { category: categories[0].slug });
  const spray = await createTestProduct(`gw-b-${tag}`, { category: categories[1].slug });

  const occasionName = `E2E Occasion ${stamp}`;
  const { data: occasion, error: e0 } = await admin
    .from("giveaway_occasions")
    .insert({ name: occasionName.slice(0, 60), slug: `e2e-occ-${stamp}`, sort: 999 })
    .select("id, slug, name")
    .single();
  if (e0) throw e0;

  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", categories[0].slug)
    .single();
  const name = `E2E Giveaway ${stamp}`;
  const slug = `e2e-giveaway-${stamp}`;
  const { data: giveaway, error } = await admin
    .from("products")
    .insert({
      slug,
      name,
      category_id: category!.id,
      active: true,
      is_giveaway: true,
      min_order_qty: 20,
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin
    .from("product_occasions")
    .insert({ product_id: giveaway.id, occasion_id: occasion.id });
  const { error: e1 } = await admin.from("giveaway_items").insert([
    { product_id: giveaway.id, variant_id: perfume.variantId, price_fils: 2500, sort: 0 },
    { product_id: giveaway.id, variant_id: spray.variantId, sort: 1 },
  ]);
  if (e1) throw e1;

  const { data: packaging, error: e2 } = await admin
    .from("product_option_groups")
    .insert({ product_id: giveaway.id, name: "Packaging", kind: "single", required: true, sort: 0 })
    .select("id")
    .single();
  if (e2) throw e2;
  const photo = "/images/products/perfumes-florals.jpg";
  await admin.from("product_options").insert([
    {
      group_id: packaging.id,
      label: "Organza pouch",
      price_delta_fils: 0,
      sort: 0,
      image_url: photo,
    },
    { group_id: packaging.id, label: "Gold box", price_delta_fils: 500, sort: 1, image_url: photo },
  ]);
  await admin.from("product_option_groups").insert({
    product_id: giveaway.id,
    name: "Names on the tag",
    kind: "text",
    required: true,
    max_length: 40,
    sort: 1,
  });

  return {
    id: giveaway.id,
    slug,
    name,
    occasion,
    perfume,
    spray,
    typeNames: [categories[0].name, categories[1].name],
  };
}

/**
 * Cached giveaway lists (the /giveaways page, the till) only see rows inserted straight into the
 * database after the catalogue refreshes: saving the giveaway's minimum in Admin → Products does
 * that, as it does for the owner. `staff` must be signed in with catalog.manage.
 */
export async function refreshCatalogue(staff: Page, productId: string) {
  await staff.goto(`/admin/products/${productId}`);
  const min = staff.getByRole("textbox", { name: "Minimum per order" });
  await min.fill("20");
  await min.press("Enter");
  await expect(staff.getByText("Minimum saved.")).toBeVisible();
}

/** Hide the run's giveaway and occasion again so they don't stay on the shop. */
export async function retireTestGiveaway(g: TestGiveaway) {
  const admin = adminClient();
  await admin.from("products").update({ active: false }).eq("id", g.id);
  await admin.from("giveaway_occasions").update({ active: false }).eq("id", g.occasion.id);
}
