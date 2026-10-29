import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dayBounds } from "@/modules/coupons/schema";
import { bannerFormSchema, offerFormSchema, toDbSlots } from "./schema";

/**
 * Admin writes for automatic offers and banners (RLS: coupons.manage). Audited by trigger.
 */

/** Create or update an offer. Returns its id. */
export async function saveOffer(input: unknown): Promise<string> {
  const staff = await assertPermission("coupons.manage");
  const v = offerFormSchema.parse(input);
  const scoped = v.kind !== "bundle";
  const row = {
    name: v.name,
    kind: v.kind,
    percent_bp: v.percentBp,
    amount_fils: v.amountFils,
    bundle_price_fils: v.bundlePriceFils,
    buy_qty: v.kind === "buy_x_get_y" ? v.buyQty : null,
    get_qty: v.kind === "buy_x_get_y" ? v.getQty : null,
    product_ids: scoped ? v.productIds : [],
    category_ids: scoped ? v.categoryIds : [],
    slots: v.kind === "bundle" ? toDbSlots(v.slots) : [],
    channels: v.channels,
    ...dayBounds(v.startsOn, v.endsOn),
    active: v.active,
    sort: v.sort,
  };
  const supabase = await createClient();
  const { data, error } = v.id
    ? await supabase.from("offers").update(row).eq("id", v.id).select("id").single()
    : await supabase
        .from("offers")
        .insert({ ...row, created_by: staff.userId })
        .select("id")
        .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function setOfferActive(id: string, active: boolean) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("offers").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Paid orders keep the offer's name and discount on their lines. */
export async function deleteOffer(id: string) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Banners ──────────────────────────────────────────────────────────────────────────────────

/** Create or update a banner. Only homepage banners carry a title and an image. Returns its id. */
export async function saveBanner(input: unknown): Promise<string> {
  await assertPermission("coupons.manage");
  const v = bannerFormSchema.parse(input);
  const homepage = v.placement === "homepage";
  const imageUrl = homepage ? v.imageUrl : null;
  const imagePath = homepage && imageUrl ? v.imagePath : null;
  const row = {
    placement: v.placement,
    title: homepage ? v.title : null,
    body: v.body,
    link_url: v.linkUrl,
    link_label: v.linkUrl ? v.linkLabel : null,
    image_url: imageUrl,
    image_path: imagePath,
    ...dayBounds(v.startsOn, v.endsOn),
    active: v.active,
    sort: v.sort,
  };
  const supabase = await createClient();
  const previous = v.id
    ? (await supabase.from("promo_banners").select("image_path").eq("id", v.id).maybeSingle()).data
    : null;
  const { data, error } = v.id
    ? await supabase.from("promo_banners").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("promo_banners").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  if (previous?.image_path && previous.image_path !== imagePath)
    await removeBannerImage(previous.image_path);
  return data.id;
}

export async function setBannerActive(id: string, active: boolean) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("promo_banners").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBanner(id: string) {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_banners")
    .delete()
    .eq("id", id)
    .select("image_path")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.image_path) await removeBannerImage(data.image_path);
}

/** Best effort: a leftover image in the bucket is harmless, so a failure is only logged. */
async function removeBannerImage(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("banners").remove([path]);
  if (error) console.error(`banner image ${path} not removed: ${error.message}`);
}
