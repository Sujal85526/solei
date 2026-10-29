import { z } from "zod";
import { businessDay, businessDayRange } from "@/lib/dates";
import { aedToFils, formatAED, type Fils } from "@/lib/money";

/**
 * Promotions — discount codes (website checkout only). The owner names the code, picks what it
 * gives (% off, AED off or free delivery) and which rules apply; every rule is optional. The
 * database enforces them again at order time (`coupon_evaluate`, `create_web_order`). Internally
 * still called coupons (table, permission `coupons.manage`).
 */

export type CouponKind = "percent" | "fixed" | "free_delivery" | "buy_x_get_y";

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
  /** Orders per customer (by email); null = no limit. */
  perCustomerLimit: number | null;
  minOrderFils: Fils | null;
  /** Scope: empty product and category lists = the whole bag. */
  productIds: string[];
  categoryIds: string[];
  /** Buy X get Y codes: buy `buyQty`, get `getQty` at `percentBp` off (10000 = free). */
  buyQty: number | null;
  getQty: number | null;
  /** Usable with other codes and on items an automatic offer already reduced. */
  combinable: boolean;
  /** Where it works: the website and/or the event till. */
  channels: ("website" | "pos")[];
  /** An event's code: reported per event; at the till only at that event. */
  eventId: string | null;
  /** Only for these VIP tiers and/or these customers (both empty = anyone). */
  tierIds: string[];
  customerIds: string[];
  /** The segment the customers were taken from. */
  segmentId: string | null;
  /** A personal birthday code (made automatically). */
  birthday: boolean;
  active: boolean;
  createdAt: string;
};

export const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, "");

export const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

export const day = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date");

export const positiveInt = z
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
  });

export const positiveAed = (label: string) =>
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

/**
 * Admin create / edit form. `value` is a percentage (e.g. 10 or 12.5) or AED amount by kind;
 * unused for free delivery.
 */
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
    kind: z.enum(["percent", "fixed", "free_delivery", "buy_x_get_y"]),
    buyQty: positiveInt,
    getQty: positiveInt,
    combinable: checkbox,
    channels: z
      .array(z.enum(["website", "pos"]))
      .min(1, "Choose where it works")
      .default(["website"]),
    eventId: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    tierIds: z.array(z.uuid()).default([]),
    segmentId: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    value: z.string().trim().optional().default(""),
    startsOn: day,
    endsOn: day,
    maxUses: positiveInt,
    perCustomerLimit: positiveInt,
    minOrder: positiveAed("a minimum"),
    productIds: z.array(z.uuid()).default([]),
    categoryIds: z.array(z.uuid()).default([]),
    active: checkbox,
  })
  .transform((v, ctx) => {
    const n = Number(v.value.replace(/[,\s%]/g, ""));
    let percentBp: number | null = null;
    let amountFils: Fils | null = null;
    if (v.kind !== "free_delivery" && v.kind !== "buy_x_get_y" && !v.value) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the discount" });
      return z.NEVER;
    }
    if (v.kind === "buy_x_get_y") {
      if (!v.buyQty || v.buyQty > 20) {
        ctx.addIssue({ code: "custom", path: ["buyQty"], message: "Buy 1 to 20" });
        return z.NEVER;
      }
      if (!v.getQty || v.getQty > 20) {
        ctx.addIssue({ code: "custom", path: ["getQty"], message: "Get 1 to 20" });
        return z.NEVER;
      }
      const pct = v.value ? Number(v.value.replace(/[,\s%]/g, "")) : 100;
      percentBp = Math.round(pct * 100);
      if (
        !Number.isFinite(pct) ||
        pct <= 0 ||
        pct > 100 ||
        Math.abs(pct * 100 - percentBp) > 1e-6
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "A percentage from 0.01 to 100 (100 = free)",
        });
        return z.NEVER;
      }
    } else if (v.kind === "percent") {
      percentBp = Math.round(n * 100);
      if (!Number.isFinite(n) || n <= 0 || n > 100 || Math.abs(n * 100 - percentBp) > 1e-6) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage from 0.01 to 100" });
        return z.NEVER;
      }
    } else if (v.kind === "fixed") {
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
    const bxgy = v.kind === "buy_x_get_y";
    return {
      ...v,
      percentBp,
      amountFils,
      buyQty: bxgy ? v.buyQty : null,
      getQty: bxgy ? v.getQty : null,
    };
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

/** "10% off", "AED 50 off", "Free delivery", "Buy 2 get 1 free". */
export function couponValueLabel(
  c: Pick<Coupon, "kind" | "percentBp" | "amountFils"> & Partial<Pick<Coupon, "buyQty" | "getQty">>,
) {
  if (c.kind === "free_delivery") return "Free delivery";
  if (c.kind === "buy_x_get_y")
    return `Buy ${c.buyQty ?? "?"} get ${c.getQty ?? "?"} ${
      c.percentBp === 10000 ? "free" : `${(c.percentBp ?? 0) / 100}% off`
    }`;
  return c.kind === "percent"
    ? `${(c.percentBp ?? 0) / 100}% off`
    : `${formatAED(c.amountFils ?? 0)} off`;
}

/** "All products", "Perfumes, Soho", … — what the code applies to. */
export function couponScopeLabel(
  c: Pick<Coupon, "productIds" | "categoryIds">,
  names: Map<string, string>,
): string {
  const ids = [...c.categoryIds, ...c.productIds];
  if (ids.length === 0) return "All products";
  return ids.map((id) => names.get(id) ?? "Removed item").join(", ");
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
  | "no_eligible_items"
  | "not_here"
  | "not_eligible"
  | "not_combinable"
  | "min_items";

export function refusalMessage(
  reason: CouponRefusal,
  minOrderFils?: number | null,
  minItems?: number | null,
): string {
  switch (reason) {
    case "not_here":
      return "This code can't be used here.";
    case "not_eligible":
      return "This code is for selected customers — sign in with the account it was sent to.";
    case "not_combinable":
      return "This code can't be combined with your other code.";
    case "min_items":
      return `Add at least ${minItems ?? 2} eligible items to use this code.`;
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
