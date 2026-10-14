import { z } from "zod";
import { Constants, type Database } from "@/lib/database.types";
import { normalizePhone } from "@/lib/phone";

export const emirates = Constants.public.Enums.emirate;
export const customerSources = Constants.public.Enums.customer_source;
export const orderChannels = Constants.public.Enums.order_channel;
export type Emirate = (typeof emirates)[number];
export type CustomerSource = (typeof customerSources)[number];
export type OrderChannel = Database["public"]["Enums"]["order_channel"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Marketing channels a customer can consent to (homepage opt-in uses the same keys). */
export const marketingChannels = ["email", "whatsapp"] as const;
export type MarketingChannel = (typeof marketingChannels)[number];

export const emirateLabels: Record<Emirate, string> = {
  abu_dhabi: "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  umm_al_quwain: "Umm Al Quwain",
  ras_al_khaimah: "Ras Al Khaimah",
  fujairah: "Fujairah",
};

export const sourceLabels: Record<CustomerSource, string> = {
  website: "Website",
  pos: "Event POS",
  whatsapp: "WhatsApp",
  direct: "Direct",
  booking: "Event booking",
  newsletter: "Newsletter",
  import: "Import",
  manual: "Added by staff",
};

export const channelLabels: Record<OrderChannel, string> = {
  website: "Website",
  pos: "Event POS",
  whatsapp: "WhatsApp",
  direct: "Direct",
  payment_link: "Payment link",
  booking: "Booking",
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  new: "New",
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const paymentStatusLabels: Record<string, string> = {
  paid: "Paid",
  partially_paid: "Part paid",
  pending: "Unpaid",
  refunded: "Refunded",
};

export const channelLabel = (channel: string) =>
  ({ email: "Email", whatsapp: "WhatsApp" })[channel] ?? channel;

// ---------------------------------------------------------------------------------------------
// Shared field parsers (FormData values arrive as strings; blank means "not given").

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalText = (max: number) =>
  z
    .preprocess(blankToNull, z.string().trim().max(max).nullable().optional())
    .transform((v) => v ?? null);

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal(""), z.null()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

/** Optional phone in any UAE/international format → E.164 or null. */
export const optionalPhone = z.preprocess(
  blankToNull,
  z
    .string()
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v == null) return null;
      const r = normalizePhone(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.error });
        return z.NEVER;
      }
      return r.e164;
    }),
);

export const optionalEmail = z
  .preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() || null : v),
    z.email("Enter a valid email").max(254).nullable().optional(),
  )
  .transform((v) => v ?? null);

const optionalEmirate = z
  .preprocess(blankToNull, z.enum(emirates).nullable().optional())
  .transform((v) => v ?? null);

const contactRequired = (v: { phone: string | null; email: string | null }) =>
  Boolean(v.phone || v.email);
const contactIssue = { message: "Enter a phone number or an email", path: ["phone"] };

// ---------------------------------------------------------------------------------------------
// Quick-create (picker, list page, POS, manual orders)

export const createCustomerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the customer's name").max(80),
    phone: optionalPhone,
    email: optionalEmail,
    emirate: optionalEmirate,
    marketingConsent: checkbox,
    source: z.preprocess(blankToNull, z.enum(customerSources).nullable().optional()),
  })
  .refine(contactRequired, contactIssue)
  .transform((v) => ({ ...v, source: v.source ?? "manual" }));
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type CreateCustomerData = z.output<typeof createCustomerSchema>;

/** Channels a consenting customer can be reached on, given the contact details we hold. */
export function consentChannels(contact: {
  phone: string | null;
  email: string | null;
}): MarketingChannel[] {
  const channels: MarketingChannel[] = [];
  if (contact.email) channels.push("email");
  if (contact.phone) channels.push("whatsapp");
  return channels;
}

// ---------------------------------------------------------------------------------------------
// Profile edits

export const updateContactSchema = z
  .object({
    id: z.uuid(),
    name: z.preprocess(blankToNull, z.string().trim().min(2, "Enter a name").max(80).nullable()),
    phone: optionalPhone,
    email: optionalEmail,
    emirate: optionalEmirate,
    line1: optionalText(160),
    line2: optionalText(160),
    area: optionalText(80),
    city: optionalText(80),
  })
  .refine(contactRequired, contactIssue)
  .transform(({ line1, line2, area, city, ...rest }) => ({
    ...rest,
    address:
      line1 || line2 || area || city ? { line1, line2, area, city, emirate: rest.emirate } : null,
  }));

export const updateNotesSchema = z.object({
  id: z.uuid(),
  notes: optionalText(4000),
});

export const recordConsentSchema = z
  .object({
    id: z.uuid(),
    channels: z.array(z.enum(marketingChannels)).default([]),
  })
  .refine((v) => v.channels.length > 0, {
    message: "Choose at least one channel",
    path: ["channels"],
  });

export const optOutSchema = z.object({ id: z.uuid() });

/** Address JSON as stored on customers.address (see migration 005). */
export type CustomerAddress = {
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  emirate?: string | null;
  notes?: string | null;
};

export function parseAddress(value: unknown): CustomerAddress {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CustomerAddress)
    : {};
}

// ---------------------------------------------------------------------------------------------
// List filters (from URL search params)

export const sortKeys = ["recent", "spent", "name", "newest"] as const;
export type SortKey = (typeof sortKeys)[number];
export const sortLabels: Record<SortKey, string> = {
  recent: "Last purchase",
  spent: "Total spent",
  name: "Name",
  newest: "Newest customers",
};

/** Unknown or invalid URL values fall back to "no filter" instead of erroring. */
const oneOf = <T extends string>(values: readonly T[]) =>
  z.unknown().transform((v) => ((values as readonly unknown[]).includes(v) ? (v as T) : undefined));

export const customerFiltersSchema = z.object({
  q: z.unknown().transform((v) => (typeof v === "string" ? v.trim().slice(0, 80) : "")),
  consent: oneOf(["yes", "no"] as const),
  source: oneOf(customerSources),
  emirate: oneOf(emirates),
  orders: oneOf(["yes", "no"] as const),
  sort: oneOf(sortKeys).transform((v): SortKey => v ?? "recent"),
  page: z.unknown().transform((v) => {
    const n = Number(typeof v === "string" ? v : 1);
    return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
  }),
});
export type CustomerFilters = z.output<typeof customerFiltersSchema>;

/** Parse Next.js searchParams (string | string[] | undefined values) into filters. */
export function parseCustomerFilters(
  sp: Record<string, string | string[] | undefined> | URLSearchParams,
): CustomerFilters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return Array.isArray(v) ? v[0] : (v ?? undefined);
  };
  return customerFiltersSchema.parse({
    q: get("q"),
    consent: get("consent"),
    source: get("source"),
    emirate: get("emirate"),
    orders: get("orders"),
    sort: get("sort"),
    page: get("page"),
  });
}

/** Filters → query string (drops defaults), for pagination and the CSV export link. */
export function filtersToQuery(
  f: Partial<CustomerFilters>,
  overrides: Partial<CustomerFilters> = {},
) {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.consent) params.set("consent", merged.consent);
  if (merged.source) params.set("source", merged.source);
  if (merged.emirate) params.set("emirate", merged.emirate);
  if (merged.orders) params.set("orders", merged.orders);
  if (merged.sort && merged.sort !== "recent") params.set("sort", merged.sort);
  if (merged.page && merged.page > 1) params.set("page", String(merged.page));
  return params.toString();
}

/** Average order value in fils (integer, half-up). */
export function averageOrderFils(totalFils: number, orderCount: number): number {
  if (orderCount <= 0) return 0;
  return Math.floor((totalFils * 2 + orderCount) / (orderCount * 2));
}

/** Marketing consent state shown as a badge. */
export function consentState(c: {
  marketing_consent: boolean | null;
  unsubscribed_at: string | null;
}): "opted_in" | "unsubscribed" | "none" {
  if (c.marketing_consent) return "opted_in";
  if (c.unsubscribed_at) return "unsubscribed";
  return "none";
}
