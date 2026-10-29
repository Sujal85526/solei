import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/modules/catalog/schema";
import { giveawaySettingsSchema, occasionSchema } from "./schema";

/** A product's giveaway settings (occasions + the bottles it offers), in one transaction. */
export async function saveGiveaway(input: unknown) {
  await assertPermission("catalog.manage");
  const v = giveawaySettingsSchema.parse(input);
  if (v.isGiveaway && !v.items.some((i) => i.active)) {
    throw new UserError("Add at least one bottle customers can choose.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("giveaway_save", {
    p: {
      product_id: v.productId,
      is_giveaway: v.isGiveaway,
      occasion_ids: v.occasionIds,
      items: v.items.map((i) => ({
        variant_id: i.variantId,
        price_fils: i.price ?? null,
        active: i.active,
      })),
    },
  });
  if (error) {
    if (error.code === "22023")
      throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1));
    throw new Error(error.message);
  }
}

export async function saveOccasion(input: unknown) {
  await assertPermission("catalog.manage");
  const v = occasionSchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    blurb: v.blurb ?? null,
    image_url: v.imageUrl ?? null,
    storage_path: v.storagePath ?? null,
    active: v.active,
    sort: v.sort,
  };
  const { data, error } = v.id
    ? await supabase.from("giveaway_occasions").update(row).eq("id", v.id).select("id").single()
    : await supabase
        .from("giveaway_occasions")
        .insert({ ...row, slug: slugify(v.name) || "occasion" })
        .select("id")
        .single();
  if (error) {
    if (error.code === "23505") throw new UserError("That occasion already exists.");
    throw new Error(error.message);
  }
  return data;
}
