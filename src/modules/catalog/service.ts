import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  destinationSchema,
  imageSchema,
  productSchema,
  slugify,
  variantSchema,
} from "./schema";

import { optionGroupFormSchema } from "./options";

const PRODUCT_BUCKET = "products";

function uniqueViolation(error: { code?: string; message: string }, what: string): never {
  if (error.code === "23505") {
    if (/slug/.test(error.message)) throw new UserError(`That ${what} URL (slug) is already used.`);
    if (/sku/.test(error.message))
      throw new UserError("That SKU is already used by another variant.");
    if (/barcode/.test(error.message)) throw new UserError("That barcode is already used.");
    throw new UserError(`That ${what} already exists.`);
  }
  throw new Error(error.message);
}

export async function saveCategory(input: unknown) {
  await assertPermission("catalog.manage");
  const v = categorySchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    slug: v.slug || slugify(v.name).replace(/-/g, "_"),
    description: v.description ?? null,
    active: v.active,
    sort: v.sort,
  };
  const { data, error } = v.id
    ? await supabase.from("categories").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("categories").insert(row).select("id").single();
  if (error) uniqueViolation(error, "category");
  return data;
}

export async function saveDestination(input: unknown) {
  await assertPermission("catalog.manage");
  const v = destinationSchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    slug: v.slug || slugify(v.name),
    country: v.country ?? null,
    region: v.region ?? null,
    mood: v.mood ?? null,
    story: v.story ?? null,
    accent_colour: v.accentColour ?? null,
    postcard_image_url: v.postcardImageUrl ?? null,
    hero_image_url: v.heroImageUrl ?? null,
    active: v.active,
    sort: v.sort,
  };
  const { data, error } = v.id
    ? await supabase.from("destinations").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("destinations").insert(row).select("id").single();
  if (error) uniqueViolation(error, "destination");
  return data;
}

export async function saveProduct(input: unknown) {
  await assertPermission("catalog.manage");
  const v = productSchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    slug: v.slug || slugify(v.name),
    category_id: v.categoryId,
    destination_id: v.destinationId ?? null,
    description: v.description ?? null,
    notes_top: v.notesTop,
    notes_heart: v.notesHeart,
    notes_base: v.notesBase,
    active: v.active,
    featured: v.featured,
    sort: v.sort,
  };
  const { data, error } = v.id
    ? await supabase.from("products").update(row).eq("id", v.id).select("id, slug").single()
    : await supabase.from("products").insert(row).select("id, slug").single();
  if (error) uniqueViolation(error, "product");
  return data;
}

export async function setProductActive(productId: string, active: boolean) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active }).eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function saveVariant(input: unknown) {
  const staff = await assertPermission("catalog.manage");
  const v = variantSchema.parse(input);
  const supabase = await createClient();
  const row = {
    product_id: v.productId,
    label: v.label || (v.sizeMl ? `${v.sizeMl} ml` : ""),
    size_ml: v.sizeMl ?? null,
    sku: v.sku,
    barcode: v.barcode ?? null,
    price_fils: v.price,
    low_stock_threshold: v.lowStockThreshold ?? null,
    active: v.active,
  };
  const { data, error } = v.id
    ? await supabase.from("product_variants").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("product_variants").insert(row).select("id").single();
  if (error) uniqueViolation(error, "variant");

  // Unit cost is only touched by people allowed to see it.
  if (v.cost !== undefined && can(staff.permissions, "reports.financial.view")) {
    const { error: costError } = await supabase
      .from("variant_costs")
      .upsert({ variant_id: data.id, cost_fils: v.cost, updated_by: staff.userId });
    if (costError) throw new Error(costError.message);
  }
  return data;
}

/** Variants with history can't be deleted (ledger integrity) — deactivate instead. */
export async function deleteVariant(variantId: string) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  const [{ count: movements }, { count: lines }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId),
    supabase
      .from("order_lines")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId),
  ]);
  if ((movements ?? 0) > 0 || (lines ?? 0) > 0) {
    throw new UserError("This variant has stock or sales history. Deactivate it instead.");
  }
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
  if (error) throw new Error(error.message);
}

/** Record an image the browser uploaded to Storage (path products/<productId>/<file>). */
export async function addProductImage(input: unknown) {
  await assertPermission("catalog.manage");
  const v = imageSchema.parse(input);
  if (!v.storagePath.startsWith(`products/${v.productId}/`))
    throw new UserError("Upload doesn't match this product.");
  const supabase = await createClient();
  const objectPath = v.storagePath.slice(`${PRODUCT_BUCKET}/`.length);
  const { data: pub } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(objectPath);
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", v.productId);
  const { error } = await supabase.from("product_images").insert({
    product_id: v.productId,
    url: pub.publicUrl,
    storage_path: objectPath,
    alt: v.alt,
    sort: count ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function updateImageAlt(imageId: string, alt: string) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_images")
    .update({ alt: alt.trim().slice(0, 200) })
    .eq("id", imageId);
  if (error) throw new Error(error.message);
}

/** Persist a new image order (array of image ids, first = cover). */
export async function reorderImages(productId: string, imageIds: string[]) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  await Promise.all(
    imageIds.map((id, sort) =>
      supabase.from("product_images").update({ sort }).eq("id", id).eq("product_id", productId),
    ),
  );
}

export async function deleteImage(imageId: string) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .single();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw new Error(error.message);
  if (img?.storage_path) await supabase.storage.from(PRODUCT_BUCKET).remove([img.storage_path]);
}

/** Save a giveaway option group with its options (one transaction in the database). */
export async function saveOptionGroup(input: unknown): Promise<string> {
  await assertPermission("catalog.manage");
  const v = optionGroupFormSchema.parse(input);
  for (const o of v.options) {
    if (o.storagePath && !o.storagePath.startsWith(`${v.productId}/options/`))
      throw new UserError("A photo doesn't match this product.");
    if (o.imageUrl && !/^(https:\/\/|\/)/.test(o.imageUrl))
      throw new UserError("Photos must be uploaded here.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("product_option_group_save", {
    p: {
      id: v.id ?? null,
      product_id: v.productId,
      name: v.name,
      kind: v.kind,
      required: v.required,
      max_length: v.maxLength,
      options: v.options.map((o) => ({
        id: o.id ?? null,
        label: o.label,
        price_delta_fils: o.priceDelta,
        active: o.active,
        image_url: o.imageUrl ?? null,
        storage_path: o.storagePath ?? null,
      })),
    },
  });
  if (error) {
    if (error.code === "22023")
      throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1));
    throw new Error(error.message);
  }
  return data;
}

/** Orders keep what was chosen (their own snapshot), so a group can go at any time. */
export async function deleteOptionGroup(groupId: string) {
  await assertPermission("catalog.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("product_option_groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function setMinOrderQty(productId: string, qty: number) {
  await assertPermission("catalog.manage");
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 10_000) {
    throw new UserError("A whole number, 1 or more.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ min_order_qty: qty })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}
