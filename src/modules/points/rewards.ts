import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";
import { rewardFormSchema } from "@/modules/promotions/schema";

/**
 * The points rewards catalogue (a product for N points): customers choose them at checkout or
 * staff add them at the event till. The database prices and spends them (`promo_price`,
 * `points_redeem_reward`); this is the admin's add / edit / remove.
 */

const rethrow = (error: { code?: string; message: string }): never => {
  if (error.code === "23505") throw new UserError("That product already is a reward.");
  throw new Error(error.message);
};

/** Add or edit a reward. Returns its id. */
export async function saveReward(input: unknown): Promise<string> {
  await assertPermission("loyalty.manage");
  const v = rewardFormSchema.parse(input);
  const supabase = await createClient();
  const row = { variant_id: v.variantId, points: v.points, active: v.active, sort: v.sort };
  const { data, error } = v.id
    ? await supabase.from("points_rewards").update(row).eq("id", v.id).select("id").single()
    : await supabase.from("points_rewards").insert(row).select("id").single();
  if (error) rethrow(error);
  return data!.id;
}

export async function deleteReward(id: string) {
  await assertPermission("loyalty.manage");
  if (!isUuid(id)) throw new UserError("Reward not found.");
  const supabase = await createClient();
  const { error } = await supabase.from("points_rewards").delete().eq("id", id);
  if (error) rethrow(error);
}

export async function setRewardActive(id: string, active: boolean) {
  await assertPermission("loyalty.manage");
  if (!isUuid(id)) throw new UserError("Reward not found.");
  const supabase = await createClient();
  const { error } = await supabase.from("points_rewards").update({ active }).eq("id", id);
  if (error) rethrow(error);
}
