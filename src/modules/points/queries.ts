import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { BirthdayReward, PointsEntry, PointsSummary, RewardsSettings, Tier } from "./schema";

/** Programme settings + tiers (public, cached under the settings tag; refreshed on save). */
export async function getRewardsProgramme(): Promise<{ settings: RewardsSettings; tiers: Tier[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.settings);
  const db = createPublicClient();
  const [s, t] = await Promise.all([
    db.from("rewards_settings").select("*").eq("id", 1).single(),
    db
      .from("loyalty_tiers")
      .select("name, min_spend_fils, points_multiplier_bp, perks")
      .order("min_spend_fils"),
  ]);
  if (s.error) throw new Error(s.error.message);
  if (t.error) throw new Error(t.error.message);
  return {
    settings: {
      enabled: s.data.points_enabled,
      pointsPerAed: s.data.points_per_aed,
      pointValueFils: s.data.point_value_fils,
      minRedeemPoints: s.data.min_redeem_points,
      birthdayEnabled: s.data.birthday_enabled,
      birthdayPoints: s.data.birthday_points,
      // Defaults before the promotions migration (columns missing): points only, 10% for 30 days.
      birthdayReward: (s.data.birthday_reward ?? "points") as BirthdayReward,
      birthdayCodePercentBp:
        s.data.birthday_code_percent_bp ?? (s.data.birthday_code_amount_fils ? null : 1000),
      birthdayCodeAmountFils: s.data.birthday_code_amount_fils ?? null,
      birthdayCodeValidDays: s.data.birthday_code_valid_days ?? 30,
      birthdayCodeMinOrderFils: s.data.birthday_code_min_order_fils ?? null,
    },
    tiers: t.data.map((x) => ({
      name: x.name,
      minSpendFils: x.min_spend_fils,
      multiplierBp: x.points_multiplier_bp,
      perks: x.perks,
    })),
  };
}

type RawSummary = {
  enabled: boolean;
  balance: number;
  balance_value_fils: number;
  min_redeem_points: number;
  point_value_fils: number;
  spend_12m_fils: number;
  tier: { name: string; multiplier_bp: number; perks: string | null } | null;
  next_tier: { name: string; min_spend_fils: number; to_go_fils: number } | null;
  recent: {
    entry: PointsEntry;
    points: number;
    note: string | null;
    order_id: string | null;
    created_at: string;
  }[];
};

const toSummary = (r: RawSummary): PointsSummary => ({
  enabled: r.enabled,
  balance: r.balance,
  balanceValueFils: r.balance_value_fils,
  minRedeemPoints: r.min_redeem_points,
  pointValueFils: r.point_value_fils,
  spend12mFils: r.spend_12m_fils,
  tier: r.tier
    ? { name: r.tier.name, multiplierBp: r.tier.multiplier_bp, perks: r.tier.perks }
    : null,
  nextTier: r.next_tier
    ? {
        name: r.next_tier.name,
        minSpendFils: r.next_tier.min_spend_fils,
        toGoFils: r.next_tier.to_go_fils,
      }
    : null,
  recent: r.recent.map((e) => ({
    entry: e.entry,
    points: e.points,
    note: e.note,
    orderId: e.order_id,
    createdAt: e.created_at,
  })),
});

/** Staff view of a customer's points (loyalty.view). */
export async function customerPoints(customerId: string): Promise<PointsSummary> {
  await assertPermission("loyalty.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("points_summary", { p_customer: customerId });
  if (error) throw new Error(error.message);
  return toSummary(data as RawSummary);
}

/**
 * The customer record behind a storefront account: the one linked to it, else the oldest with
 * its email (same rule as the Passport). Service role — callers pass a signed-in account.
 */
export async function customerForAccount(user: { id: string; email?: string | null }) {
  const admin = createAdminClient();
  const { data: linked } = await admin
    .from("customers")
    .select("id, birth_month, birth_day")
    .eq("auth_user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (linked || !user.email) return linked;
  const { data } = await admin
    .from("customers")
    .select("id, birth_month, birth_day")
    .eq("email", user.email.toLowerCase())
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data;
}

/** Points summary for a customer id, without a staff check (callers check who's asking). */
export async function pointsSummaryFor(customerId: string): Promise<PointsSummary> {
  const { data, error } = await createAdminClient().rpc("points_summary", {
    p_customer: customerId,
  });
  if (error) throw new Error(error.message);
  return toSummary(data as RawSummary);
}

export type PointsOverview = {
  members: number;
  outstandingPoints: number;
  outstandingValueFils: number;
  earned30d: number;
  spent30d: number;
  tiers: { name: string; members: number }[];
};

export async function pointsOverview(): Promise<PointsOverview> {
  await assertPermission("loyalty.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("points_overview");
  if (error) throw new Error(error.message);
  const r = data as {
    members: number;
    outstanding_points: number;
    outstanding_value_fils: number;
    earned_30d: number;
    spent_30d: number;
    tiers: { name: string; members: number }[];
  };
  return {
    members: r.members,
    outstandingPoints: r.outstanding_points,
    outstandingValueFils: r.outstanding_value_fils,
    earned30d: r.earned_30d,
    spent30d: r.spent_30d,
    tiers: r.tiers,
  };
}
