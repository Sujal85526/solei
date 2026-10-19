import { z } from "zod";
import { businessDay, businessDayRange } from "@/lib/dates";
import { aedToFils, formatAED, type Fils } from "@/lib/money";

/**
 * Discount coupons (website checkout only). The owner names the code and picks which rules apply
 * when creating it; every rule is optional. The database enforces them again at order time
 * (`coupon_evaluate`, `create_web_order`).
 */

export type CouponKind = "percent" | "fixed";

export type Coupon = {
  id: string;
  code: string;
  description: string | null;
  kind: CouponKind;
  percentBp: number | null;
  amountFils: Fils | null;
  /** Business days (Asia/Dubai), inclusive; null = no limit. */
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  oncePerCustomer: boolean;
  minOrderFils: Fils | null;
  productIds: string[];
  active: boolean;
  createdAt: string;
};

export const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

const day = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date");

const positiveAed = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v.replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in AED, e.g. 50` });
        return z.NEVER;
      }
      return aedToFils(n);
    });

/** Admin create / edit form. `value` is a percentage (e.g. 10 or 12.5) or AED amount by kind. */
export const couponFormSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    code: z
      .string()
      .transform(normaliseCode)
      .refine((v) => CODE_PATTERN.test(v), "3–32 letters, numbers, - or _ (e.g. SUMMER20)"),
    description: optionalText.pipe(z.string().max(200).nullable()),
    kind: z.enum(["percent", "fixed"]),
    value: z.string().trim().min(1, "Enter the discount"),
    startsOn: day,
    endsOn: day,
    maxUses: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = Number(v);
        if (!Number.isSafeInteger(n) || n < 1) {
          ctx.addIssue({ code: "custom", message: "A whole number, 1 or more" });
          return z.NEVER;
        }
        return n;
      }),
    oncePerCustomer: checkbox,
    minOrder: positiveAed("a minimum"),
    productIds: z.array(z.uuid()).default([]),
    active: checkbox,
  })
  .transform((v, ctx) => {
    const n = Number(v.value.replace(/[,\s%]/g, ""));
    let percentBp: number | null = null;
    let amountFils: Fils | null = null;
    if (v.kind === "percent") {
      percentBp = Math.round(n * 100);
      if (!Number.isFinite(n) || n <= 0 || n > 100 || Math.abs(n * 100 - percentBp) > 1e-6) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage from 0.01 to 100" });
        return z.NEVER;
      }
    } else {
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Enter an amount in AED, e.g. 50",
        });
        return z.NEVER;
      }
      amountFils = aedToFils(n);
    }
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "Ends before it starts" });
      return z.NEVER;
    }
    return { ...v, percentBp, amountFils };
  });

export type CouponFormData = z.output<typeof couponFormSchema>;

/** Start of the first day / end of the last day, in Asia/Dubai, as stored timestamps. */
export function dayBounds(startsOn: string | null, endsOn: string | null) {
  return {
    starts_at: startsOn ? businessDayRange(startsOn).start.toISOString() : null,
    ends_at: endsOn ? businessDayRange(endsOn).end.toISOString() : null,
  };
}

/** Stored timestamps back to the inclusive business days shown in the form. */
export function storedDays(startsAt: string | null, endsAt: string | null) {
  return {
    startsOn: startsAt ? businessDay(new Date(startsAt)) : null,
    endsOn: endsAt ? businessDay(new Date(new Date(endsAt).getTime() - 1)) : null,
  };
}

/** "10% off", "AED 50 off". */
export function couponValueLabel(c: Pick<Coupon, "kind" | "percentBp" | "amountFils">) {
  return c.kind === "percent"
    ? `${(c.percentBp ?? 0) / 100}% off`
    : `${formatAED(c.amountFils ?? 0)} off`;
}

export type CouponState = "active" | "paused" | "scheduled" | "expired" | "used_up";

export function couponState(c: Coupon, uses: number, today = businessDay()): CouponState {
  if (!c.active) return "paused";
  if (c.endsOn && c.endsOn < today) return "expired";
  if (c.maxUses !== null && uses >= c.maxUses) return "used_up";
  if (c.startsOn && c.startsOn > today) return "scheduled";
  return "active";
}

/** Why a code was refused (reasons from `coupon_evaluate`), in customer wording. */
export type CouponRefusal =
  | "invalid"
  | "not_started"
  | "expired"
  | "used_up"
  | "already_used"
  | "min_order"
  | "no_eligible_items";

export function refusalMessage(reason: CouponRefusal, minOrderFils?: number | null): string {
  switch (reason) {
    case "not_started":
      return "This code isn't active yet.";
    case "expired":
      return "This code has expired.";
    case "used_up":
      return "This code is no longer available.";
    case "already_used":
      return "You've already used this code.";
    case "min_order":
      return `Spend at least ${formatAED(minOrderFils ?? 0)} to use this code.`;
    case "no_eligible_items":
      return "This code doesn't apply to the items in your bag.";
    default:
      return "This code isn't valid.";
  }
}
