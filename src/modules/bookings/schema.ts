import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { businessDay } from "@/lib/dates";
import { normalizePhone } from "@/lib/phone";

/*
 * Booking wizard schemas — shared by the client (per-step validation) and the server action
 * (whole request). The database re-validates everything in `submit_booking`.
 */

export const emirateSchema = z.enum(Constants.public.Enums.emirate);
const id = z.guid("Choose an option");
const optionalId = z
  .union([z.guid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time");

export const MAX_GUESTS = 10_000;
export const MAX_PRODUCT_QTY = 10_000;

/** Wizard state as typed by the customer (inputs are strings). Saved as a local draft. */
export type BookingDraft = {
  eventTypeId: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  emirate: string;
  guests: string;
  serviceTypeIds: string[];
  /** "" = not sure yet — Solei suggests one in the quotation. */
  packageId: string;
  /** "" = no preference. */
  boothDesignId: string;
  flowers: boolean;
  flowerOptionId: string;
  /** category slug → quantity input. */
  products: Record<string, string>;
  name: string;
  phone: string;
  email: string;
  specialRequests: string;
  consent: boolean;
  marketingConsent: boolean;
};

export const emptyDraft: BookingDraft = {
  eventTypeId: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  emirate: "",
  guests: "",
  serviceTypeIds: [],
  packageId: "",
  boothDesignId: "",
  flowers: false,
  flowerOptionId: "",
  products: {},
  name: "",
  phone: "",
  email: "",
  specialRequests: "",
  consent: false,
  marketingConsent: false,
};

export const eventTypeStep = z.object({ eventTypeId: id });

export const detailsStep = z
  .object({
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
      .refine((d) => d >= businessDay(), "Choose a date from today")
      .refine((d) => Number(d.slice(0, 4)) <= Number(businessDay().slice(0, 4)) + 3, {
        message: "Choose a date within the next three years",
      }),
    startTime: time,
    endTime: time,
    location: z.string().trim().min(2, "Enter the venue or area").max(200),
    emirate: z.enum(Constants.public.Enums.emirate, "Choose the emirate"),
    guests: z.coerce
      .number("Enter the number of guests")
      .int("Whole numbers only")
      .min(1, "Enter the number of guests")
      .max(MAX_GUESTS, "For more than 10,000 guests, tell us in your special requests"),
  })
  .refine((v) => v.startTime !== v.endTime, {
    path: ["endTime"],
    message: "The end time must differ from the start",
  });

export const servicesStep = z.object({
  serviceTypeIds: z.array(z.guid()).min(1, "Choose at least one service").max(20),
});

export const packageStep = z.object({ packageId: optionalId });
export const boothStep = z.object({ boothDesignId: optionalId });

export const flowersStep = z
  .object({ flowers: z.boolean(), flowerOptionId: optionalId })
  .refine((v) => !v.flowers || v.flowerOptionId, {
    path: ["flowerOptionId"],
    message: "Choose a flower colour",
  })
  .transform((v) => ({ flowers: v.flowers, flowerOptionId: v.flowers ? v.flowerOptionId : null }));

const qty = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? 0 : Number(v)))
  .pipe(
    z
      .number("Enter a quantity")
      .int("Whole numbers only")
      .min(0, "Enter 0 or more")
      .max(MAX_PRODUCT_QTY, "For more than 10,000, tell us in your special requests"),
  );

export const productsStep = z.object({
  products: z.record(z.string().regex(/^[a-z0-9_-]+$/), qty).transform((r) =>
    Object.entries(r)
      .filter(([, n]) => n > 0)
      .map(([category, n]) => ({ category, qty: n })),
  ),
});

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const r = normalizePhone(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.e164;
  });

export const contactStep = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(120),
  phone,
  email: z.email("Enter a valid email").trim().toLowerCase(),
  specialRequests: z.string().trim().max(2000, "Keep it under 2,000 characters").default(""),
  consent: z.literal(true, "Please agree so we can contact you about your event"),
  marketingConsent: z.boolean().default(false),
});

export const WIZARD_STEPS = [
  { id: "type", title: "Occasion", schema: eventTypeStep },
  { id: "details", title: "Date & place", schema: detailsStep },
  { id: "services", title: "Services", schema: servicesStep },
  { id: "package", title: "Package", schema: packageStep },
  { id: "booth", title: "Booth", schema: boothStep },
  { id: "flowers", title: "Flowers", schema: flowersStep },
  { id: "products", title: "Products", schema: productsStep },
  { id: "contact", title: "Your details", schema: contactStep },
  { id: "summary", title: "Summary", schema: null },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** Field errors for one step (first message per field), or null when the step is valid. */
export function validateStep(
  stepIndex: number,
  draft: BookingDraft,
): Record<string, string> | null {
  const schema = WIZARD_STEPS[stepIndex]?.schema;
  if (!schema) return null;
  const r = schema.safeParse(draft);
  if (r.success) return null;
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
  return errors;
}

/** First step with a problem (to jump back to), or -1. */
export function firstInvalidStep(draft: BookingDraft): number {
  return WIZARD_STEPS.findIndex((_, i) => validateStep(i, draft) !== null);
}

/** The whole request, as sent to the `submitBooking` action. */
export const bookingRequestSchema = z
  .object({ clientUuid: z.uuid() })
  .and(eventTypeStep)
  .and(detailsStep)
  .and(servicesStep)
  .and(packageStep)
  .and(boothStep)
  .and(flowersStep)
  .and(productsStep)
  .and(contactStep);

export type BookingRequest = z.output<typeof bookingRequestSchema>;

/** Estimate preview input (no contact details needed). */
export const estimatePreviewSchema = z
  .object({ packageId: optionalId })
  .and(flowersStep)
  .and(productsStep);

/** Payload for `submit_booking` (snake_case, as the RPC expects). */
export function toSubmitPayload(v: BookingRequest) {
  return {
    client_uuid: v.clientUuid,
    event_type_id: v.eventTypeId,
    event_date: v.eventDate,
    start_time: v.startTime,
    end_time: v.endTime,
    location: v.location,
    emirate: v.emirate,
    guests: v.guests,
    service_type_ids: [...new Set(v.serviceTypeIds)],
    package_id: v.packageId,
    booth_design_id: v.boothDesignId,
    flowers: v.flowers,
    flower_option_id: v.flowerOptionId,
    products_interest: v.products,
    special_requests: v.specialRequests,
    contact: { name: v.name, phone: v.phone, email: v.email },
    consent: v.consent,
    marketing_consent: v.marketingConsent,
  };
}

// ─── Admin ───────────────────────────────────────────────────────────────────────────────────

const aed = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""))))
    .pipe(
      z
        .number(`Enter ${label}`)
        .min(0, `${label} can't be negative`)
        .max(10_000_000, `${label} is too large`),
    )
    .transform((n) => Math.round(n * 100));

export const quoteLineSchema = z.object({
  label: z.string().trim().min(1, "Describe the line").max(200),
  qty: z.coerce.number().int("Whole numbers only").min(1).max(100_000),
  unitPriceFils: z.coerce.number().int().min(0).max(1_000_000_000),
});

export const sendQuoteSchema = z.object({
  bookingId: z.guid(),
  lines: z.array(quoteLineSchema).min(1, "Add at least one line").max(50),
  discountFils: z.coerce.number().int().min(0).default(0),
  depositFils: z.coerce.number().int().min(0).nullable().default(null),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((d) => d >= businessDay(), "The quote must be valid until today or later"),
  notes: z.string().trim().max(2000).default(""),
  sendEmail: z.boolean().default(true),
});

export const statusChangeSchema = z
  .object({
    bookingId: z.guid(),
    status: z.enum(["in_review", "rejected", "cancelled", "completed"]),
    reason: z.string().trim().max(500).default(""),
  })
  .refine((v) => !["rejected", "cancelled"].includes(v.status) || v.reason.length >= 3, {
    path: ["reason"],
    message: "Give a reason (the customer may see it)",
  });

export const messageSchema = z.object({
  bookingId: z.guid(),
  kind: z.enum(["note", "email", "whatsapp"]),
  body: z.string().trim().min(1, "Write a message").max(5000),
});

export const paymentRequestSchema = z.object({
  bookingId: z.guid(),
  kind: z.enum(["deposit", "balance"]),
});

const lines = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) =>
      v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max),
    );

const imageUrls = lines(8).pipe(
  z.array(
    z
      .string()
      .refine(
        (u) => u.startsWith("/") || /^https:\/\//.test(u),
        "Image URLs must start with / or https://",
      ),
  ),
);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

const base = {
  id: z
    .guid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Enter a name").max(80),
  sort: z.coerce.number().int().min(0).max(10_000).default(0),
  active: checkbox,
};
const description = z.string().trim().max(1000).default("");

export const configSchemas = {
  eventType: z.object(base),
  service: z.object({ ...base, description: description.pipe(z.string().max(500)) }),
  package: z.object({
    ...base,
    description,
    inclusions: lines(20),
    basePrice: aed("a price"),
    images: imageUrls,
  }),
  booth: z.object({ ...base, description, photos: imageUrls }),
  flower: z.object({
    ...base,
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a colour like #F7CDD0"),
    price: aed("a surcharge"),
  }),
} as const;

export type ConfigKind = keyof typeof configSchemas;

export const bookingSettingsSchema = z.object({
  depositPercent: z.coerce
    .number("Enter a percentage")
    .min(0, "0–100%")
    .max(100, "0–100%")
    .transform((n) => Math.round(n * 100)),
  flowerBase: aed("a price"),
  validityDays: z.coerce.number().int().min(1, "At least 1 day").max(365, "At most 365 days"),
});
