import { z } from "zod";
import { aedToFils, filsToAed, formatAED, type Fils } from "@/lib/money";

/**
 * Automatic customer labels (New, Returning, VIP, Inactive). The database works them out
 * (`customer_label()`, used by `customer_summary` and segments) from rules the owner edits; this
 * file is the wording, the rules form and a mirror of the rule order for tests.
 */
export const customerLabels = ["vip", "new", "returning", "inactive"] as const;
export type CustomerLabel = (typeof customerLabels)[number];

export const labelNames: Record<CustomerLabel, string> = {
  vip: "VIP",
  new: "New",
  returning: "Returning",
  inactive: "Inactive",
};

export const labelBadgeVariant = {
  vip: "pink",
  new: "success",
  returning: "secondary",
  inactive: "muted",
} as const satisfies Record<CustomerLabel, string>;

export const isCustomerLabel = (v: unknown): v is CustomerLabel =>
  (customerLabels as readonly unknown[]).includes(v);

/** Owner rules (settings.label_*). */
export type LabelRules = {
  vipSpendFils: Fils;
  vipMonths: number;
  inactiveDays: number;
  newDays: number;
  returningOrders: number;
};

export const DEFAULT_LABEL_RULES: LabelRules = {
  vipSpendFils: 200_000,
  vipMonths: 12,
  inactiveDays: 180,
  newDays: 30,
  returningOrders: 2,
};

/** One line per label, as shown on the settings page and the customer list. */
export function describeLabelRules(r: LabelRules): Record<CustomerLabel, string> {
  return {
    vip: `Spent ${formatAED(r.vipSpendFils)} or more in the last ${r.vipMonths} months`,
    inactive: `No purchase in the last ${r.inactiveDays} days`,
    new: `First purchase in the last ${r.newDays} days`,
    returning: `${r.returningOrders} or more purchases`,
  };
}

/**
 * Same order as the database: VIP, then Inactive, then New, then Returning; nothing for
 * customers who never bought (or bought once, a while ago, but are not inactive yet).
 */
export function labelFor(
  s: { orders: number; firstAt: Date | null; lastAt: Date | null; recentSpentFils: Fils },
  r: LabelRules,
  now: Date,
): CustomerLabel | null {
  const daysAgo = (d: Date) => (now.getTime() - d.getTime()) / 86_400_000;
  if (s.orders <= 0) return null;
  if (r.vipSpendFils > 0 && s.recentSpentFils >= r.vipSpendFils) return "vip";
  if (s.lastAt && daysAgo(s.lastAt) > r.inactiveDays) return "inactive";
  if (s.firstAt && daysAgo(s.firstAt) <= r.newDays) return "new";
  if (s.orders >= r.returningOrders) return "returning";
  return null;
}

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (!v || !Number.isSafeInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label}: a whole number from ${min} to ${max}` });
        return z.NEVER;
      }
      return n;
    });

/** The rules form (FormData strings) → LabelRules. */
export const labelRulesSchema = z.object({
  vipSpend: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v.replace(/[,\s]/g, ""));
      if (!v || !Number.isFinite(n) || n < 1 || n > 1_000_000) {
        ctx.addIssue({ code: "custom", message: "An amount in AED, e.g. 2000" });
        return z.NEVER;
      }
      return aedToFils(n);
    }),
  vipMonths: wholeNumber("Months", 1, 60),
  inactiveDays: wholeNumber("Days", 7, 1825),
  newDays: wholeNumber("Days", 1, 365),
  returningOrders: wholeNumber("Purchases", 2, 50),
});

export const labelRulesToForm = (r: LabelRules) => ({
  vipSpend: String(filsToAed(r.vipSpendFils)),
  vipMonths: String(r.vipMonths),
  inactiveDays: String(r.inactiveDays),
  newDays: String(r.newDays),
  returningOrders: String(r.returningOrders),
});
