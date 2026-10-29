import { z } from "zod";
import { aedToFils, filsToAed, formatAED, type Fils } from "@/lib/money";
import { emirateLabels } from "@/modules/customers/schema";
import { emirates } from "@/modules/cart/schema";
import { customerLabels, labelNames, type CustomerLabel } from "@/modules/customers/labels";

/**
 * Customer segments (saved filters) and email campaigns. The database evaluates the rules
 * (`segment_members`) and decides who can be emailed (agreed to email marketing, not
 * unsubscribed); this file is validation, wording and the unsubscribe footer.
 */

export type Emirate = (typeof emirates)[number];
export type PassportRule = "has" | "none" | "reward";

/** Stored rules (snake_case jsonb in `customer_segments.rules`). */
export type SegmentRules = {
  min_spent_fils?: Fils;
  max_spent_fils?: Fils;
  min_orders?: number;
  purchased_within_days?: number;
  not_purchased_days?: number;
  destination_ids?: string[];
  passport?: PassportRule;
  emirates?: Emirate[];
  /** Automatic labels (New / Returning / VIP / Inactive). */
  labels?: CustomerLabel[];
  consent?: "opted_in";
};

const optionalInt = (label: string, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const n = Number(v);
      if (!Number.isSafeInteger(n) || n < 1 || n > max) {
        ctx.addIssue({ code: "custom", message: `${label}: a whole number from 1 to ${max}` });
        return z.NEVER;
      }
      return n;
    });

const optionalAed = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = Number(v.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "An amount in AED, e.g. 500" });
      return z.NEVER;
    }
    return aedToFils(n);
  });

/** The segment form (FormData values) → name, description and stored rules. */
export const segmentFormSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    name: z.string().trim().min(1, "Give it a name").max(80),
    description: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => v || null),
    minSpent: optionalAed,
    maxSpent: optionalAed,
    minOrders: optionalInt("Orders", 1000),
    purchasedWithinDays: optionalInt("Days", 3650),
    notPurchasedDays: optionalInt("Days", 3650),
    destinationIds: z.array(z.uuid()).default([]),
    passport: z
      .enum(["", "has", "none", "reward"])
      .optional()
      .transform((v) => (v ? v : undefined)),
    emirates: z.array(z.enum(emirates)).default([]),
    labels: z.array(z.enum(customerLabels)).default([]),
    consent: z
      .union([z.literal("on"), z.literal(""), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "on"),
  })
  .superRefine((v, ctx) => {
    if (v.minSpent !== undefined && v.maxSpent !== undefined && v.maxSpent < v.minSpent) {
      ctx.addIssue({ code: "custom", path: ["maxSpent"], message: "Less than the minimum" });
    }
    if (v.purchasedWithinDays && v.notPurchasedDays) {
      ctx.addIssue({
        code: "custom",
        path: ["notPurchasedDays"],
        message: "Pick one: bought recently or not recently",
      });
    }
  })
  .transform((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    rules: toRules(v),
  }));

function toRules(v: {
  minSpent?: Fils;
  maxSpent?: Fils;
  minOrders?: number;
  purchasedWithinDays?: number;
  notPurchasedDays?: number;
  destinationIds: string[];
  passport?: PassportRule;
  emirates: Emirate[];
  labels: CustomerLabel[];
  consent: boolean;
}): SegmentRules {
  const r: SegmentRules = {};
  if (v.minSpent !== undefined) r.min_spent_fils = v.minSpent;
  if (v.maxSpent !== undefined) r.max_spent_fils = v.maxSpent;
  if (v.minOrders) r.min_orders = v.minOrders;
  if (v.purchasedWithinDays) r.purchased_within_days = v.purchasedWithinDays;
  if (v.notPurchasedDays) r.not_purchased_days = v.notPurchasedDays;
  if (v.destinationIds.length) r.destination_ids = v.destinationIds;
  if (v.passport) r.passport = v.passport;
  if (v.emirates.length) r.emirates = v.emirates;
  if (v.labels.length) r.labels = v.labels;
  if (v.consent) r.consent = "opted_in";
  return r;
}

/** Stored rules back to the form's values. */
export function rulesToForm(r: SegmentRules) {
  return {
    minSpent: r.min_spent_fils !== undefined ? String(filsToAed(r.min_spent_fils)) : "",
    maxSpent: r.max_spent_fils !== undefined ? String(filsToAed(r.max_spent_fils)) : "",
    minOrders: r.min_orders ? String(r.min_orders) : "",
    purchasedWithinDays: r.purchased_within_days ? String(r.purchased_within_days) : "",
    notPurchasedDays: r.not_purchased_days ? String(r.not_purchased_days) : "",
    destinationIds: r.destination_ids ?? [],
    passport: r.passport ?? "",
    emirates: r.emirates ?? [],
    labels: r.labels ?? [],
    consent: r.consent === "opted_in",
  };
}

const PASSPORT_TEXT: Record<PassportRule, string> = {
  has: "has a Solei Passport",
  none: "no Passport yet",
  reward: "has a reward waiting",
};

/** "Spent AED 500+ · bought in the last 30 days · Capri, Verona" — the rules in a line. */
export function rulesSummary(r: SegmentRules, destinationNames: Map<string, string>): string {
  const parts: string[] = [];
  if (r.min_spent_fils !== undefined && r.max_spent_fils !== undefined)
    parts.push(`spent ${formatAED(r.min_spent_fils)}–${formatAED(r.max_spent_fils)}`);
  else if (r.min_spent_fils !== undefined) parts.push(`spent ${formatAED(r.min_spent_fils)}+`);
  else if (r.max_spent_fils !== undefined) parts.push(`spent up to ${formatAED(r.max_spent_fils)}`);
  if (r.min_orders) parts.push(`${r.min_orders}+ orders`);
  if (r.purchased_within_days) parts.push(`bought in the last ${r.purchased_within_days} days`);
  if (r.not_purchased_days) parts.push(`nothing in the last ${r.not_purchased_days} days`);
  if (r.destination_ids?.length)
    parts.push(r.destination_ids.map((id) => destinationNames.get(id) ?? "?").join(", "));
  if (r.passport) parts.push(PASSPORT_TEXT[r.passport]);
  if (r.emirates?.length) parts.push(r.emirates.map((e) => emirateLabels[e]).join(", "));
  if (r.labels?.length) parts.push(r.labels.map((l) => labelNames[l]).join(" or "));
  if (r.consent) parts.push("agreed to marketing");
  const text = parts.join(" · ") || "every customer";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Campaign draft. Subject/body may be empty while drafting; sending checks them. */
export const campaignFormSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Give it a name").max(120),
  subject: z.string().trim().max(200).default(""),
  body: z.string().max(20_000).default(""),
  segmentId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** segment = a saved segment (email marketing consent); event_news = event news subscribers. */
export type CampaignAudience = "segment" | "event_news";

export function readyToSend(c: {
  subject: string;
  body: string;
  segmentId: string | null;
  audience?: CampaignAudience;
}) {
  if (c.audience !== "event_news" && !c.segmentId) return "Choose who it goes to.";
  if (!c.subject.trim()) return "Write a subject line.";
  if (!c.body.trim()) return "Write the email.";
  return null;
}

/**
 * Every campaign email ends with this; it can't be edited out. The link is per recipient.
 */
export const UNSUBSCRIBE_FOOTER =
  "You're receiving this because you agreed to hear from Solei. [Unsubscribe]({{unsubscribe_link}})";

/** Event announcements go to customers who asked for event news, not to every opt-in. */
export const EVENT_NEWS_FOOTER =
  "You're receiving this because you asked for news about Solei events. [Unsubscribe]({{unsubscribe_link}})";

export const withFooter = (body: string, audience: CampaignAudience = "segment") =>
  `${body.trimEnd()}\n\n${audience === "event_news" ? EVENT_NEWS_FOOTER : UNSUBSCRIBE_FOOTER}`;

export const CAMPAIGN_VARIABLES = ["first_name"] as const;
