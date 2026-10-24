import { z } from "zod";
import { aedToFils, filsToAed, formatAED, type Fils } from "@/lib/money";

/**
 * Points, VIP tiers and the birthday bonus — beside the Solei Passport (stamps are a separate
 * programme and don't change). The database earns, spends and checks everything
 * (`points_*` functions); this file is the forms, wording and the checkout arithmetic.
 */

export type RewardsSettings = {
  enabled: boolean;
  pointsPerAed: number;
  pointValueFils: Fils;
  minRedeemPoints: number;
  birthdayEnabled: boolean;
  birthdayPoints: number;
};

export type Tier = {
  name: string;
  minSpendFils: Fils;
  /** 10000 = ×1. */
  multiplierBp: number;
  perks: string | null;
};

export type PointsSummary = {
  enabled: boolean;
  balance: number;
  balanceValueFils: Fils;
  minRedeemPoints: number;
  pointValueFils: Fils;
  spend12mFils: Fils;
  tier: { name: string; multiplierBp: number; perks: string | null } | null;
  nextTier: { name: string; minSpendFils: Fils; toGoFils: Fils } | null;
  recent: {
    entry: PointsEntry;
    points: number;
    note: string | null;
    orderId: string | null;
    createdAt: string;
  }[];
};

export type PointsEntry = "earn" | "redeem" | "refund" | "reverse" | "adjust" | "birthday";

export const POINTS_ENTRY_LABELS: Record<PointsEntry, string> = {
  earn: "Earned",
  redeem: "Spent",
  refund: "Given back",
  reverse: "Taken back",
  adjust: "Adjusted",
  birthday: "Birthday bonus",
};

/** "×1.25" */
export const multiplierText = (bp: number) => `×${(bp / 10000).toFixed(2).replace(/\.?0+$/, "")}`;

/**
 * How many points an order can take: the most that fit in what's due (whole points), only from
 * the minimum up. 0 when points can't be used.
 */
export function pointsForOrder(
  balance: number,
  dueFils: Fils,
  pointValueFils: Fils,
  minRedeem: number,
): number {
  if (balance < minRedeem || pointValueFils <= 0) return 0;
  const fit = Math.min(balance, Math.floor(dueFils / pointValueFils));
  return fit >= minRedeem ? fit : 0;
}

/** "780 points · AED 39" */
export const pointsText = (points: number, valueFils: Fils) =>
  `${points.toLocaleString("en-GB")} point${points === 1 ? "" : "s"} · ${formatAED(points * valueFils)}`;

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

const int = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (!Number.isSafeInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label}: ${min} to ${max}` });
        return z.NEVER;
      }
      return n;
    });

/** Owner settings. The point value is typed in AED (e.g. 0.05). */
export const rewardsSettingsSchema = z.object({
  enabled: checkbox,
  pointsPerAed: int("Points per AED", 1, 100),
  pointValue: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      const fils = Math.round(n * 100);
      if (!Number.isFinite(n) || fils < 1 || fils > 10_000 || Math.abs(n * 100 - fils) > 1e-6) {
        ctx.addIssue({ code: "custom", message: "In AED with up to 2 decimals, e.g. 0.05" });
        return z.NEVER;
      }
      return fils;
    }),
  minRedeemPoints: int("Minimum", 1, 1_000_000),
  birthdayEnabled: checkbox,
  birthdayPoints: int("Birthday points", 1, 100_000),
});

/** One tier row of the tiers form (AED and "1.25" in, fils and basis points out). */
export const tierRowSchema = z.object({
  name: z.string().trim().min(1, "Name the tier").max(40),
  minSpend: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/[,\s]/g, "") || "0");
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: "An amount in AED" });
        return z.NEVER;
      }
      return aedToFils(n);
    }),
  multiplier: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/^×/, ""));
      const bp = Math.round(n * 10000);
      if (!Number.isFinite(n) || bp < 10000 || bp > 50000) {
        ctx.addIssue({ code: "custom", message: "From 1 to 5, e.g. 1.25" });
        return z.NEVER;
      }
      return bp;
    }),
  perks: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export const tiersSchema = z
  .array(tierRowSchema)
  .min(1, "At least one tier")
  .max(6)
  .superRefine((rows, ctx) => {
    if (!rows.some((r) => r.minSpend === 0)) {
      ctx.addIssue({ code: "custom", message: "The first tier must start at AED 0" });
    }
    if (new Set(rows.map((r) => r.minSpend)).size !== rows.length) {
      ctx.addIssue({ code: "custom", message: "Two tiers have the same spend" });
    }
  })
  .transform((rows) => [...rows].sort((a, b) => a.minSpend - b.minSpend));

export const tierFormValues = (t: Tier) => ({
  name: t.name,
  minSpend: String(filsToAed(t.minSpendFils)),
  multiplier: String(t.multiplierBp / 10000),
  perks: t.perks ?? "",
});

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Birthday (day and month only). Both empty = remove. */
export const birthdaySchema = z
  .object({
    month: z.coerce.number().int().min(0).max(12),
    day: z.coerce.number().int().min(0).max(31),
  })
  .superRefine((v, ctx) => {
    if ((v.month === 0) !== (v.day === 0)) {
      ctx.addIssue({ code: "custom", path: ["day"], message: "Choose the day and the month" });
    } else if (v.month && v.day > DAYS_IN_MONTH[v.month - 1]) {
      ctx.addIssue({ code: "custom", path: ["day"], message: "That month is shorter" });
    }
  })
  .transform((v) => (v.month ? { month: v.month, day: v.day } : null));

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const pointsAdjustSchema = z.object({
  customerId: z.uuid(),
  points: z.coerce
    .number()
    .int("Whole points")
    .refine((n) => n !== 0, "Enter points (minus to take off)"),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});
