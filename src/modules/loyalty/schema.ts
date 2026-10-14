import { z } from "zod";
import { aedToFils, formatAED } from "@/lib/money";
import type { RewardStatus, RewardType, StampKind } from "./engine";

export const rewardTypes = [
  "choose_from_category",
  "specific_products",
  "fixed_amount",
  "percent",
] as const satisfies readonly RewardType[];

export const rewardTypeLabels: Record<RewardType, string> = {
  choose_from_category: "Customer chooses from a category",
  specific_products: "Customer chooses from specific products",
  fixed_amount: "Fixed amount off (AED)",
  percent: "Percentage off",
};

/** Item rewards become a zero-priced order line; value rewards are marked used on an order. */
export const isItemReward = (t: RewardType) =>
  t === "choose_from_category" || t === "specific_products";

export const stampKindLabels: Record<StampKind, string> = {
  earned: "Earned",
  manual: "Manual",
  reversed: "Reversed",
  redeemed: "Exchanged",
  expired: "Expired",
};

export const rewardStatusLabels: Record<RewardStatus, string> = {
  available: "Available",
  redeemed: "Redeemed",
  expired: "Expired",
  revoked: "Withdrawn",
};

export const passportHowLabels = {
  auto: "Automatically",
  request: "On request",
  manual: "By staff",
} as const;

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const ids = z.preprocess(
  (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean),
  z.array(z.uuid()).max(500),
);
const int = (min: number, max: number, msg: string) =>
  z.coerce.number({ error: msg }).int(msg).min(min, msg).max(max, msg);
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

/** Admin → Loyalty → Settings. Every value the owner may change; saving creates a rule version. */
export const loyaltySettingsSchema = z
  .object({
    enabled: checkbox,
    stampsPerItem: int(1, 100, "Between 1 and 100"),
    qualifying: z.enum(["all", "some"]),
    qualifyingCategoryIds: ids,
    qualifyingProductIds: ids,
    stampsForReward: int(1, 1000, "Between 1 and 1000"),
    rewardType: z.enum(rewardTypes),
    rewardCategoryId: z.preprocess(blankToUndefined, z.uuid().optional()),
    rewardProductIds: ids,
    rewardAmountAed: z.preprocess(blankToUndefined, z.string().trim().optional()),
    rewardPercent: z.preprocess(blankToUndefined, z.coerce.number().optional()),
    rewardLabel: z
      .string()
      .trim()
      .min(3, "Describe the reward, e.g. “a free all-over spray”")
      .max(120),
    passportAuto: checkbox,
    issuePassportAfterPurchases: z.preprocess(blankToUndefined, z.coerce.number().optional()),
    rewardItemsEarnStamps: checkbox,
    expires: checkbox,
    expiryMonths: z.preprocess(blankToUndefined, z.coerce.number().optional()),
    note: z.string().trim().max(300).optional().default(""),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.qualifying === "some" && !v.qualifyingCategoryIds.length && !v.qualifyingProductIds.length)
      issue("qualifyingCategoryIds", "Choose at least one category or product");
    if (v.rewardType === "choose_from_category" && !v.rewardCategoryId)
      issue("rewardCategoryId", "Choose the category");
    if (v.rewardType === "specific_products" && !v.rewardProductIds.length)
      issue("rewardProductIds", "Choose at least one product");
    if (v.rewardType === "fixed_amount") {
      let fils = 0;
      try {
        fils = aedToFils(v.rewardAmountAed ?? "");
      } catch {}
      if (!(fils > 0)) issue("rewardAmountAed", "Enter an amount in AED");
    }
    if (
      v.rewardType === "percent" &&
      !(v.rewardPercent !== undefined && v.rewardPercent > 0 && v.rewardPercent <= 100)
    )
      issue("rewardPercent", "Between 0.01 and 100");
    if (
      v.passportAuto &&
      !(
        Number.isInteger(v.issuePassportAfterPurchases) &&
        v.issuePassportAfterPurchases! >= 1 &&
        v.issuePassportAfterPurchases! <= 100
      )
    )
      issue("issuePassportAfterPurchases", "Between 1 and 100 purchases");
    if (
      v.expires &&
      !(Number.isInteger(v.expiryMonths) && v.expiryMonths! >= 1 && v.expiryMonths! <= 120)
    )
      issue("expiryMonths", "Between 1 and 120 months");
  });

export type LoyaltySettingsInput = z.output<typeof loyaltySettingsSchema>;

/** Payload for `loyalty_save_rules`. */
export function toRulePayload(v: LoyaltySettingsInput) {
  const rewardConfig =
    v.rewardType === "choose_from_category"
      ? { category_id: v.rewardCategoryId }
      : v.rewardType === "specific_products"
        ? { product_ids: v.rewardProductIds }
        : v.rewardType === "fixed_amount"
          ? { amount_fils: aedToFils(v.rewardAmountAed ?? "0") }
          : { percent_bp: Math.round((v.rewardPercent ?? 0) * 100) };
  return {
    enabled: v.enabled,
    stamps_per_item: v.stampsPerItem,
    qualifying_category_ids: v.qualifying === "all" ? [] : v.qualifyingCategoryIds,
    qualifying_product_ids: v.qualifying === "all" ? [] : v.qualifyingProductIds,
    stamps_for_reward: v.stampsForReward,
    reward_type: v.rewardType,
    reward_config: rewardConfig,
    reward_label: v.rewardLabel,
    issue_passport_after_purchases: v.passportAuto ? v.issuePassportAfterPurchases : null,
    reward_items_earn_stamps: v.rewardItemsEarnStamps,
    expiry_months: v.expires ? v.expiryMonths : null,
    note: v.note,
  };
}

export const adjustStampsSchema = z.object({
  customerId: z.uuid(),
  direction: z.enum(["add", "remove"]),
  stamps: int(1, 100, "Between 1 and 100"),
  reason: z.string().trim().min(3, "Give a reason (kept in the ledger)").max(300),
  destinationId: z.preprocess(blankToUndefined, z.uuid().optional()),
});

export const issuePassportSchema = z.object({
  customerId: z.uuid(),
  how: z.enum(["request", "manual"]).default("request"),
});

export const redeemRewardSchema = z.object({
  rewardId: z.uuid(),
  customerId: z.uuid(),
  variantId: z.preprocess(blankToUndefined, z.uuid().optional()),
  orderNumber: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^SOL-\d{6}$/, "Order number like SOL-001234")
      .optional(),
  ),
  note: z.string().trim().max(300).optional().default(""),
});

export const passportEmailSchema = z.object({
  email: z.email("Enter the email you shop with").trim().toLowerCase().max(200),
});

/** Human summary of a reward config, e.g. "AED 50 off" / "10% off". */
export function rewardValueText(type: RewardType, config: Record<string, unknown>) {
  if (type === "fixed_amount") return `${formatAED(Number(config.amount_fils ?? 0))} off`;
  if (type === "percent") return `${Number(config.percent_bp ?? 0) / 100}% off`;
  return null;
}
