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
  /** What the birthday brings: bonus points, a personal discount code, or both. */
  birthdayReward: BirthdayReward;
  /** The birthday code's value: exactly one of the two is set. */
  birthdayCodePercentBp: number | null;
  birthdayCodeAmountFils: Fils | null;
  birthdayCodeValidDays: number;
  birthdayCodeMinOrderFils: Fils | null;
};

export type BirthdayReward = "points" | "code" | "both";

export const BIRTHDAY_REWARD_LABELS: Record<BirthdayReward, string> = {
  points: "Points",
  code: "A discount code",
  both: "Both",
};

export const birthdayIncludesPoints = (r: BirthdayReward) => r === "points" || r === "both";
export const birthdayIncludesCode = (r: BirthdayReward) => r === "code" || r === "both";

/** "15% off" / "AED 50 off" — the birthday code's value, for the email and the admin. */
export function birthdayDiscountText(percentBp: number | null, amountFils: Fils | null): string {
  if (percentBp != null) {
    return `${(percentBp / 100).toFixed(2).replace(/\.?0+$/, "")}% off`;
  }
  return amountFils != null ? `${formatAED(amountFils)} off` : "";
}

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

/** "15" / "12.5" (%) → basis points, or "50" (AED) → fils; null when not a valid value. */
function parseCodeValue(kind: "percent" | "amount", raw: string): number | null {
  const n = Number(raw.replace(/[,\s%]/g, ""));
  if (!raw || !Number.isFinite(n)) return null;
  const units = Math.round(n * 100);
  if (Math.abs(n * 100 - units) > 1e-6) return null;
  if (kind === "percent") return units >= 1 && units <= 10_000 ? units : null;
  return units >= 1 && units <= 10_000_000 ? units : null;
}

/** Birthday code fields of the settings form (all optional so older callers still parse). */
const birthdayCodeFields = {
  birthdayReward: z.enum(["points", "code", "both"]).default("points"),
  birthdayCodeKind: z.enum(["percent", "amount"]).default("percent"),
  /** % (e.g. 15) or AED (e.g. 50), by birthdayCodeKind. */
  birthdayCodeValue: z.string().trim().default(""),
  birthdayCodeValidDays: z.string().trim().default("30"),
  /** Optional minimum order in AED; empty = none. */
  birthdayCodeMinOrder: z.string().trim().default(""),
};

type BirthdayCodeRaw = {
  birthdayReward: BirthdayReward;
  birthdayCodeKind: "percent" | "amount";
  birthdayCodeValue: string;
  birthdayCodeValidDays: string;
  birthdayCodeMinOrder: string;
};

/**
 * Settle the birthday code: value as basis points or fils (exactly one; both null = an empty value
 * while the reward is points only, so the stored value is kept), days 1–365, minimum order or null.
 */
function birthdayCodeTransform<T extends BirthdayCodeRaw>(v: T, ctx: z.RefinementCtx) {
  const {
    birthdayCodeKind: kind,
    birthdayCodeValue: rawValue,
    birthdayCodeValidDays: rawDays,
    birthdayCodeMinOrder: rawMin,
    ...rest
  } = v;
  const needsCode = birthdayIncludesCode(v.birthdayReward);
  const value = parseCodeValue(kind, rawValue);
  if (value == null && (needsCode || rawValue)) {
    ctx.addIssue({
      code: "custom",
      path: ["birthdayCodeValue"],
      message:
        kind === "percent" ? "A percentage from 0.01 to 100, e.g. 15" : "An amount in AED, e.g. 50",
    });
  }
  const days = Number(rawDays || "30");
  if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
    ctx.addIssue({ code: "custom", path: ["birthdayCodeValidDays"], message: "1 to 365 days" });
  }
  let minOrder: number | null = null;
  if (rawMin) {
    minOrder = parseCodeValue("amount", rawMin);
    if (minOrder == null) {
      ctx.addIssue({
        code: "custom",
        path: ["birthdayCodeMinOrder"],
        message: "An amount in AED, or leave empty",
      });
    }
  }
  return {
    ...rest,
    birthdayCodePercentBp: value != null && kind === "percent" ? value : null,
    birthdayCodeAmountFils: value != null && kind === "amount" ? value : null,
    birthdayCodeValidDays: days,
    birthdayCodeMinOrderFils: minOrder,
  };
}

/** Owner settings. The point value is typed in AED (e.g. 0.05). */
export const rewardsSettingsSchema = z
  .object({
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
    ...birthdayCodeFields,
  })
  .transform(birthdayCodeTransform);

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
