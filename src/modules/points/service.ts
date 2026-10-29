import "server-only";
import { pointsSwitchLocked } from "@/lib/env.server";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { formatAED } from "@/lib/money";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { currentAccount } from "@/modules/account/service";
import { notify } from "@/modules/notifications/service";
import { customerForAccount, getRewardsProgramme, pointsSummaryFor } from "./queries";
import {
  birthdayDiscountText,
  birthdayIncludesCode,
  birthdayIncludesPoints,
  birthdaySchema,
  pointsAdjustSchema,
  pointsForOrder,
  rewardsSettingsSchema,
  tiersSchema,
  type PointsSummary,
} from "./schema";

const rethrow = (error: { code?: string; message: string }, what: string): never => {
  if (["P0001", "22023", "42501"].includes(error.code ?? "")) {
    throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1));
  }
  throw new Error(`${what} failed: ${error.message}`);
};

export async function saveRewardsSettings(input: unknown) {
  const staff = await assertPermission("loyalty.manage");
  const v = rewardsSettingsSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("rewards_settings")
    .update({
      // Locked deployments keep the shared on/off switch as it is (see pointsSwitchLocked).
      ...(pointsSwitchLocked() ? {} : { points_enabled: v.enabled }),
      points_per_aed: v.pointsPerAed,
      point_value_fils: v.pointValue,
      min_redeem_points: v.minRedeemPoints,
      birthday_enabled: v.birthdayEnabled,
      birthday_points: v.birthdayPoints,
      birthday_reward: v.birthdayReward,
      // An empty code value (reward is points only) keeps the stored one.
      ...(v.birthdayCodePercentBp != null || v.birthdayCodeAmountFils != null
        ? {
            birthday_code_percent_bp: v.birthdayCodePercentBp,
            birthday_code_amount_fils: v.birthdayCodeAmountFils,
          }
        : {}),
      birthday_code_valid_days: v.birthdayCodeValidDays,
      birthday_code_min_order_fils: v.birthdayCodeMinOrderFils,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function saveTiers(input: unknown) {
  await assertPermission("loyalty.manage");
  const rows = tiersSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("loyalty_tiers_save", {
    p: rows.map((r) => ({
      name: r.name,
      min_spend_fils: r.minSpend,
      points_multiplier_bp: r.multiplier,
      perks: r.perks,
    })),
  });
  if (error) rethrow(error, "loyalty_tiers_save");
}

/** Returns the new balance. */
export async function adjustPoints(input: unknown): Promise<number> {
  await assertPermission("loyalty.adjust");
  const v = pointsAdjustSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("points_adjust", {
    p_customer: v.customerId,
    p_points: v.points,
    p_reason: v.reason,
  });
  if (error) rethrow(error, "points_adjust");
  return data as number;
}

/** Staff set a customer's birthday (customers.manage). */
export async function setCustomerBirthday(customerId: string, input: unknown) {
  await assertPermission("customers.manage");
  const b = birthdaySchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ birth_month: b?.month ?? null, birth_day: b?.day ?? null })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
}

/** The signed-in customer's points (null when signed out or not a customer yet). */
export async function myRewards(): Promise<
  (PointsSummary & { customerId: string; birthday: { month: number; day: number } | null }) | null
> {
  const account = await currentAccount();
  if (!account) return null;
  const customer = await customerForAccount(account.user);
  if (!customer) return null;
  const summary = await pointsSummaryFor(customer.id);
  return {
    ...summary,
    customerId: customer.id,
    birthday:
      customer.birth_month && customer.birth_day
        ? { month: customer.birth_month, day: customer.birth_day }
        : null,
  };
}

/** The signed-in customer saves their birthday (day + month). */
export async function setMyBirthday(input: unknown) {
  const account = await currentAccount();
  if (!account) throw new UserError("Please sign in.");
  const b = birthdaySchema.parse(input);
  const customer = await customerForAccount(account.user);
  if (!customer) throw new UserError("Your birthday can be saved after your first order.");
  const { error } = await createAdminClient()
    .from("customers")
    .update({ birth_month: b?.month ?? null, birth_day: b?.day ?? null })
    .eq("id", customer.id);
  if (error) throw new Error(error.message);
}

export type CheckoutPoints =
  | { usable: true; customerId: string; balance: number; points: number; valueFils: number }
  | { usable: false; balance: number; reason: string };

/**
 * What the signed-in customer's points can take off an amount due (checkout). The order RPC spends
 * them again under a lock.
 */
export async function pointsForCheckout(
  dueFils: number,
  /** Points already taken by rewards in the bag. */
  reservedPoints = 0,
): Promise<CheckoutPoints | null> {
  const { settings } = await getRewardsProgramme();
  if (!settings.enabled) return null;
  const account = await currentAccount();
  if (!account) return null;
  const customer = await customerForAccount(account.user);
  if (!customer) return null;
  const summary = await pointsSummaryFor(customer.id);
  const s = { ...summary, balance: summary.balance - reservedPoints };
  if (s.balance < settings.minRedeemPoints) {
    return {
      usable: false,
      balance: s.balance,
      reason: `You can use points from ${settings.minRedeemPoints}.`,
    };
  }
  const points = pointsForOrder(
    s.balance,
    dueFils,
    settings.pointValueFils,
    settings.minRedeemPoints,
  );
  if (!points)
    return { usable: false, balance: s.balance, reason: "This order is too small for points." };
  return {
    usable: true,
    customerId: customer.id,
    balance: s.balance,
    points,
    valueFils: points * settings.pointValueFils,
  };
}

/**
 * The signed-in customer at checkout (programme on): their record and points balance, for points
 * rewards and VIP codes.
 */
export async function checkoutCustomer(): Promise<{ id: string; balance: number } | null> {
  const account = await currentAccount();
  if (!account) return null;
  const customer = await customerForAccount(account.user);
  if (!customer) return null;
  const { settings } = await getRewardsProgramme();
  return {
    id: customer.id,
    balance: settings.enabled ? (await pointsSummaryFor(customer.id)).balance : 0,
  };
}

/**
 * Give today's birthday rewards and email them (scheduler or the admin button): bonus points
 * and/or a personal discount code, by the birthday reward setting. One email per customer per year.
 */
export async function sendBirthdayBonuses(): Promise<{ given: number }> {
  const { settings } = await getRewardsProgramme();
  const withPoints = settings.enabled && birthdayIncludesPoints(settings.birthdayReward);
  const withCode = birthdayIncludesCode(settings.birthdayReward);
  if (!settings.birthdayEnabled || (!withPoints && !withCode)) return { given: 0 };
  const admin = createAdminClient();
  const { data: due, error } = await admin.rpc("birthdays_due");
  if (error) throw new Error(`birthdays_due failed: ${error.message}`);
  const shopLink = `${publicEnv.NEXT_PUBLIC_SITE_URL}/shop`;
  let given = 0;
  for (const c of due) {
    const { data: pointsData, error: pointsError } = await admin.rpc("points_birthday", {
      p_customer: c.customer_id,
    });
    // One customer's failure doesn't stop the others.
    if (pointsError) console.error(`points_birthday failed: ${pointsError.message}`);
    const points = pointsError ? 0 : (pointsData ?? 0);
    const { data: codeData, error: codeError } = await admin.rpc("birthday_code_issue", {
      p_customer: c.customer_id,
    });
    if (codeError) console.error(`birthday_code_issue failed: ${codeError.message}`);
    const code = codeError ? null : (codeData as BirthdayCode | null);
    if (!points && !code) continue;
    given++;
    const base = {
      to: c.email,
      customerId: c.customer_id,
      dedupeKey: `birthday:${c.customer_id}:${new Date().getFullYear()}`,
      dedupeHours: 24 * 300,
    };
    const customerName = c.name?.split(" ")[0] || "there";
    if (code) {
      await notify("birthday_code", {
        ...base,
        vars: {
          customer_name: customerName,
          code: code.code,
          discount: birthdayDiscountText(code.percent_bp, code.amount_fils),
          valid_until: formatBusinessDate(code.ends_at),
          points_note: points
            ? `We've also added ${points.toLocaleString("en-GB")} points to your account.`
            : "",
          shop_link: shopLink,
        },
      });
    } else {
      const summary = await pointsSummaryFor(c.customer_id);
      await notify("birthday_points", {
        ...base,
        vars: {
          customer_name: customerName,
          points: points.toLocaleString("en-GB"),
          balance: summary.balance.toLocaleString("en-GB"),
          balance_value: formatAED(summary.balanceValueFils),
          shop_link: shopLink,
        },
      });
    }
  }
  return { given };
}

type BirthdayCode = {
  code: string;
  percent_bp: number | null;
  amount_fils: number | null;
  min_order_fils: number | null;
  ends_at: string;
};

export async function runBirthdaysNow() {
  await assertPermission("loyalty.manage");
  return sendBirthdayBonuses();
}
