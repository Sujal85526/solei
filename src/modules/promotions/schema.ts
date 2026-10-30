import { z } from "zod";
import type { Database, Json } from "@/lib/database.types";
import { aedToFils, formatAED, type Fils } from "@/lib/money";
import { checkbox, day, optionalText, positiveInt, storedDays } from "@/modules/coupons/schema";

/**
 * Automatic offers (no code): sale prices, bundles and buy X get Y; homepage banners; the points
 * rewards catalogue. The database applies the offers (`promo_price`); these are the admin forms and
 * read models.
 */

export type OfferKind = "sale" | "bundle" | "buy_x_get_y";
export const OFFER_KIND_LABELS: Record<OfferKind, string> = {
  sale: "Sale price",
  bundle: "Bundle",
  buy_x_get_y: "Buy X get Y",
};

/** Report types: codes and the automatic offers. */
export const PROMOTION_KIND_LABELS: Record<"code" | OfferKind, string> = {
  code: "Code",
  sale: "Sale price",
  bundle: "Bundle",
  buy_x_get_y: "Buy X get Y",
};

export type Channel = "website" | "pos";
export const CHANNEL_LABELS: Record<Channel, string> = { website: "Website", pos: "Event till" };

export type BundleSlot = {
  label: string;
  productIds: string[];
  categoryIds: string[];
  qty: number;
};

export type Offer = {
  id: string;
  name: string;
  kind: OfferKind;
  percentBp: number | null;
  amountFils: Fils | null;
  bundlePriceFils: Fils | null;
  buyQty: number | null;
  getQty: number | null;
  productIds: string[];
  categoryIds: string[];
  slots: BundleSlot[];
  channels: Channel[];
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
  sort: number;
};

type OfferRow = Database["public"]["Tables"]["offers"]["Row"];

export function toOffer(r: OfferRow): Offer {
  const slots = Array.isArray(r.slots) ? (r.slots as Record<string, unknown>[]) : [];
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    percentBp: r.percent_bp,
    amountFils: r.amount_fils,
    bundlePriceFils: r.bundle_price_fils,
    buyQty: r.buy_qty,
    getQty: r.get_qty,
    productIds: r.product_ids,
    categoryIds: r.category_ids,
    slots: slots.map((s) => ({
      label: String(s.label ?? ""),
      productIds: (s.product_ids as string[]) ?? [],
      categoryIds: (s.category_ids as string[]) ?? [],
      qty: Number(s.qty ?? 1),
    })),
    channels: r.channels as Channel[],
    ...storedDays(r.starts_at, r.ends_at),
    active: r.active,
    sort: r.sort,
  };
}

/** "15% off", "AED 30 off", "AED 450 for the set", "Buy 2 get 1 free", "Buy 1 get 1 50% off". */
export function offerValueLabel(
  o: Pick<Offer, "kind" | "percentBp" | "amountFils" | "bundlePriceFils" | "buyQty" | "getQty">,
) {
  const pct = (bp: number | null) => `${(bp ?? 0) / 100}%`;
  switch (o.kind) {
    case "sale":
      return o.percentBp !== null
        ? `${pct(o.percentBp)} off`
        : `${formatAED(o.amountFils ?? 0)} off`;
    case "bundle":
      return o.bundlePriceFils !== null
        ? `${formatAED(o.bundlePriceFils)} for the set`
        : `${pct(o.percentBp)} off the set`;
    case "buy_x_get_y":
      return `Buy ${o.buyQty} get ${o.getQty} ${o.percentBp === 10000 ? "free" : `${pct(o.percentBp)} off`}`;
  }
}

const percentValue = (v: string) => {
  const n = Number(v.replace(/[,\s%]/g, ""));
  const bp = Math.round(n * 100);
  return Number.isFinite(n) && n > 0 && n <= 100 && Math.abs(n * 100 - bp) < 1e-6 ? bp : null;
};
const aedValue = (v: string, allowZero = false) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) ? aedToFils(n) : null;
};

const ids = z.array(z.uuid()).default([]);

const slotSchema = z.object({
  label: z.string().trim().max(40).default(""),
  productIds: ids,
  categoryIds: ids,
  qty: z.coerce.number().int().min(1).max(10).default(1),
});

/**
 * Admin create / edit form for an automatic offer. `value` is a percentage or an AED amount by
 * `valueType`; `slots` (bundles) comes as JSON from the slot editor.
 */
export const offerFormSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    name: z.string().trim().min(1, "Give it a name customers will see").max(80),
    kind: z.enum(["sale", "bundle", "buy_x_get_y"]),
    valueType: z.enum(["percent", "amount", "price"]).default("percent"),
    value: z.string().trim().optional().default(""),
    buyQty: positiveInt,
    getQty: positiveInt,
    productIds: ids,
    categoryIds: ids,
    slots: z
      .string()
      .optional()
      .default("[]")
      .transform((v, ctx) => {
        try {
          return z.array(slotSchema).parse(JSON.parse(v));
        } catch {
          ctx.addIssue({ code: "custom", message: "Check the bundle items" });
          return z.NEVER;
        }
      }),
    channels: z.array(z.enum(["website", "pos"])).min(1, "Choose where it applies"),
    startsOn: day,
    endsOn: day,
    active: checkbox,
    sort: z.coerce.number().int().min(0).max(999).default(0),
  })
  .transform((v, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
      return z.NEVER;
    };
    let percentBp: number | null = null;
    let amountFils: Fils | null = null;
    let bundlePriceFils: Fils | null = null;
    if (v.kind === "sale") {
      if (v.valueType === "amount") {
        amountFils = aedValue(v.value);
        if (amountFils === null) return issue("value", "Enter the amount off in AED, e.g. 30");
      } else {
        percentBp = percentValue(v.value);
        if (percentBp === null) return issue("value", "A percentage from 0.01 to 100");
      }
    } else if (v.kind === "bundle") {
      if (v.slots.length < 2 || v.slots.length > 6)
        return issue("slots", "A bundle has 2 to 6 items");
      if (v.slots.some((s) => s.productIds.length + s.categoryIds.length === 0))
        return issue("slots", "Choose the products or categories for every item of the bundle");
      if (v.valueType === "percent") {
        percentBp = percentValue(v.value);
        if (percentBp === null) return issue("value", "A percentage from 0.01 to 100");
      } else {
        bundlePriceFils = aedValue(v.value, true);
        if (bundlePriceFils === null)
          return issue("value", "Enter the bundle price in AED, e.g. 450");
      }
    } else {
      if (!v.buyQty || v.buyQty > 20) return issue("buyQty", "Buy 1 to 20");
      if (!v.getQty || v.getQty > 20) return issue("getQty", "Get 1 to 20");
      percentBp = v.value ? percentValue(v.value) : 10000;
      if (percentBp === null) return issue("value", "A percentage from 0.01 to 100 (100 = free)");
    }
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn)
      return issue("endsOn", "Ends before it starts");
    return { ...v, percentBp, amountFils, bundlePriceFils };
  });
export type OfferFormData = z.output<typeof offerFormSchema>;

/** Bundle slots as stored (snake case). */
export const toDbSlots = (slots: BundleSlot[]): Json[] =>
  slots.map((s) => ({
    label: s.label,
    product_ids: s.productIds,
    category_ids: s.categoryIds,
    qty: s.qty,
  }));

// ── Banners ──────────────────────────────────────────────────────────────────────────────────

export type BannerPlacement = "announcement" | "homepage";
export const PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  announcement: "Announcement bar",
  homepage: "Homepage banner",
};

export type Banner = {
  id: string;
  placement: BannerPlacement;
  title: string | null;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  startsAt: string | null;
  endsAt: string | null;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
  sort: number;
};

type BannerRow = Database["public"]["Tables"]["promo_banners"]["Row"];

export const toBanner = (r: BannerRow): Banner => ({
  id: r.id,
  placement: r.placement as BannerPlacement,
  title: r.title,
  body: r.body,
  linkUrl: r.link_url,
  linkLabel: r.link_label,
  imageUrl: r.image_url,
  imagePath: r.image_path,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  ...storedDays(r.starts_at, r.ends_at),
  active: r.active,
  sort: r.sort,
});

/** Live now and within its dates (display helper; the database filters the same way). */
export const bannerLive = (b: Pick<Banner, "active" | "startsAt" | "endsAt">, now = new Date()) =>
  b.active &&
  (!b.startsAt || new Date(b.startsAt) <= now) &&
  (!b.endsAt || new Date(b.endsAt) > now);

export const bannerFormSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    placement: z.enum(["announcement", "homepage"]),
    title: optionalText.pipe(z.string().max(80).nullable()),
    body: z.string().trim().min(1, "Write the message").max(200),
    linkUrl: optionalText.pipe(
      z
        .string()
        .max(300)
        .regex(/^(\/|https:\/\/)/, "Start with / (a page of the site) or https://")
        .nullable(),
    ),
    linkLabel: optionalText.pipe(z.string().max(40).nullable()),
    imageUrl: optionalText.pipe(z.string().max(500).nullable()),
    imagePath: optionalText,
    startsOn: day,
    endsOn: day,
    active: checkbox,
    sort: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((v) => !(v.startsOn && v.endsOn && v.endsOn < v.startsOn), {
    path: ["endsOn"],
    message: "Ends before it starts",
  });

// ── Points rewards ───────────────────────────────────────────────────────────────────────────

export type PointsReward = {
  id: string;
  variantId: string;
  name: string;
  priceFils: Fils;
  points: number;
  active: boolean;
  variantActive: boolean;
  sort: number;
};

type RewardRow = {
  id: string;
  variant_id: string;
  points: number;
  active: boolean;
  sort: number;
  variant: {
    label: string;
    price_fils: number;
    active: boolean;
    product: { name: string; active: boolean } | null;
  } | null;
};

export const toReward = (r: RewardRow): PointsReward => ({
  id: r.id,
  variantId: r.variant_id,
  name:
    [r.variant?.product?.name, r.variant?.label].filter(Boolean).join(" · ") || "Removed product",
  priceFils: r.variant?.price_fils ?? 0,
  points: r.points,
  active: r.active,
  variantActive: Boolean(r.variant?.active && r.variant.product?.active),
  sort: r.sort,
});

export const rewardFormSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  variantId: z.uuid("Choose the product"),
  points: z.coerce.number().int("Whole points").min(1, "At least 1 point").max(1_000_000),
  active: checkbox,
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

/** Rewards a balance can pay for, cheapest first. */
export const affordableRewards = (rewards: PointsReward[], balance: number) =>
  rewards
    .filter((r) => r.active && r.variantActive && r.points <= balance)
    .sort((a, b) => a.points - b.points);
