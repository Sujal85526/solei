import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { eachBusinessDay } from "@/lib/dates";
import { aedToFils } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";

const enums = Constants.public.Enums;

export const eventTypes = enums.event_type;
export const eventStatuses = enums.event_status;
export const feePaymentStatuses = enums.fee_payment_status;
export const emirates = enums.emirate;
export const expenseCategories = enums.event_expense_category;

export type EventType = (typeof eventTypes)[number];
export type EventStatus = (typeof eventStatuses)[number];
export type FeePaymentStatus = (typeof feePaymentStatuses)[number];
export type Emirate = (typeof emirates)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];

export const eventTypeLabels: Record<EventType, string> = {
  exhibition: "Exhibition",
  popup: "Pop-up",
  private_booking: "Private booking",
  other: "Other",
};
export const eventStatusLabels: Record<EventStatus, string> = {
  potential: "Potential",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const feePaymentStatusLabels: Record<FeePaymentStatus, string> = {
  not_applicable: "No fee",
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  waived: "Waived",
};
export const emirateLabels: Record<Emirate, string> = {
  abu_dhabi: "Abu Dhabi",
  dubai: "Dubai",
  sharjah: "Sharjah",
  ajman: "Ajman",
  umm_al_quwain: "Umm Al Quwain",
  ras_al_khaimah: "Ras Al Khaimah",
  fujairah: "Fujairah",
  western_region: "Western Region",
};
export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  staff: "Staff",
  transport: "Transport",
  setup: "Booth & setup",
  accommodation: "Accommodation",
  marketing: "Marketing",
  other: "Other",
};

// ─── Daily working hours ──────────────────────────────────────────────────────────────────

export type DayHours = { open: string; close: string };
/** Stored in `events.daily_hours`: one entry per business day that has hours set. */
export type DailyHours = Record<string, DayHours>;
export type DayHoursRow = { day: string; open: string; close: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Longest event we allow (a sanity cap — keeps the per-day form and calendar sane). */
export const MAX_EVENT_DAYS = 62;

/**
 * One row per day of `[start, end]`, keeping hours already entered for a day and filling new
 * days with `fallback` (the previous day's hours, so extending an event copies the pattern).
 */
export function generateDayRows(
  start: string,
  end: string,
  existing: DailyHours | DayHoursRow[] = {},
  fallback: DayHours = { open: "", close: "" },
): DayHoursRow[] {
  if (!DAY.test(start) || !DAY.test(end) || end < start) return [];
  const days = eachBusinessDay(start, end).slice(0, MAX_EVENT_DAYS);
  const known: DailyHours = Array.isArray(existing)
    ? Object.fromEntries(existing.map((r) => [r.day, { open: r.open, close: r.close }]))
    : existing;
  let last = fallback;
  return days.map((day) => {
    const hours = known[day] ?? last;
    if (known[day]?.open || known[day]?.close) last = known[day];
    return { day, open: hours.open, close: hours.close };
  });
}

/** "Same hours every day" shortcut. */
export function applySameHours(rows: DayHoursRow[], hours: DayHours): DayHoursRow[] {
  return rows.map((r) => ({ ...r, open: hours.open, close: hours.close }));
}

/** Rows → stored JSON (days without hours are dropped). Closing after midnight is allowed. */
export function rowsToDailyHours(rows: DayHoursRow[]): DailyHours {
  const out: DailyHours = {};
  for (const r of rows) if (r.open && r.close) out[r.day] = { open: r.open, close: r.close };
  return out;
}

/** Read `events.daily_hours`, ignoring anything malformed (older `{ default: … }` shape included). */
export function parseDailyHours(value: unknown): DailyHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: DailyHours = {};
  for (const [day, h] of Object.entries(value as Record<string, unknown>)) {
    if (!h || typeof h !== "object") continue;
    const { open, close } = h as Record<string, unknown>;
    if (
      typeof open === "string" &&
      typeof close === "string" &&
      TIME.test(open) &&
      TIME.test(close)
    )
      out[day] = { open, close };
  }
  return out;
}

/** "10:00–22:00" for one day, or a compact summary when every day matches. */
export function summariseHours(hours: DailyHours, start: string, end: string): string | null {
  const days = eachBusinessDay(start, end);
  const set = days.map((d) => hours[d] ?? hours.default).filter(Boolean) as DayHours[];
  if (!set.length) return null;
  const same =
    set.length === days.length &&
    set.every((h) => h.open === set[0].open && h.close === set[0].close);
  if (same) return `${set[0].open}–${set[0].close}${days.length > 1 ? " daily" : ""}`;
  return "Varies by day";
}

const dayHoursRowSchema = z
  .object({
    day: z.string().regex(DAY),
    open: z.union([z.literal(""), z.string().regex(TIME, "Use HH:MM")]),
    close: z.union([z.literal(""), z.string().regex(TIME, "Use HH:MM")]),
  })
  .refine((r) => !r.open === !r.close, { message: "Enter both opening and closing time" })
  .refine((r) => !r.open || r.open !== r.close, { message: "Opening and closing can't be equal" });

const dailyHoursField = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw) return [] as DayHoursRow[];
    try {
      const parsed: unknown = JSON.parse(raw);
      const rows = z.array(dayHoursRowSchema).max(MAX_EVENT_DAYS).safeParse(parsed);
      if (!rows.success) {
        ctx.addIssue({
          code: "custom",
          message: rows.error.issues[0]?.message ?? "Check the hours",
        });
        return z.NEVER;
      }
      return rows.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Check the hours" });
      return z.NEVER;
    }
  });

// ─── Event form ───────────────────────────────────────────────────────────────────────────

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => v || null);

const date = (msg: string) => z.string({ error: msg }).regex(DAY, msg);

/** Money typed in AED ("1,500" / "1500.50") → integer fils. */
export const aedField = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return 0;
    const cleaned = v.replace(/[,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in AED, e.g. 1500" });
      return z.NEVER;
    }
    return aedToFils(cleaned);
  });

export const eventSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    name: z.string().trim().min(2, "Enter the event name").max(120),
    type: z.enum(eventTypes).default("exhibition"),
    status: z.enum(eventStatuses).default("potential"),
    organiserName: text(120),
    organiserContact: text(120),
    organiserPhone: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const r = normalizePhone(v);
        if (!r.ok) {
          ctx.addIssue({ code: "custom", message: r.error });
          return z.NEVER;
        }
        return r.e164;
      }),
    organiserEmail: z
      .union([z.literal(""), z.email("Enter a valid email").trim().toLowerCase()])
      .optional()
      .transform((v) => v || null),
    location: text(160),
    emirate: z
      .union([z.literal(""), z.enum(emirates)])
      .optional()
      .transform((v) => v || null),
    startDate: date("Choose the first day"),
    endDate: date("Choose the last day"),
    dailyHours: dailyHoursField,
    boothDetails: text(1000),
    feeAed: aedField,
    feePaymentStatus: z.enum(feePaymentStatuses).default("not_applicable"),
    notes: text(4000),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The last day can't be before the first day",
  })
  .refine((v) => eachBusinessDay(v.startDate, v.endDate).length <= MAX_EVENT_DAYS, {
    path: ["endDate"],
    message: `Events can last up to ${MAX_EVENT_DAYS} days`,
  })
  .transform((v) => ({
    ...v,
    // Only keep hours for days inside the (possibly changed) date range.
    dailyHours: rowsToDailyHours(
      v.dailyHours.filter((r) => r.day >= v.startDate && r.day <= v.endDate),
    ),
    participationFeeFils: v.feeAed,
  }));
export type EventInput = z.output<typeof eventSchema>;

export const overlapQuerySchema = z
  .object({
    startDate: z.string().regex(DAY),
    endDate: z.string().regex(DAY),
    excludeId: z.uuid().optional(),
    location: z.string().trim().max(160).optional(),
  })
  .refine((v) => v.endDate >= v.startDate);

// ─── Staff, expenses, documents ───────────────────────────────────────────────────────────

export const assignStaffSchema = z.object({
  eventId: z.uuid(),
  userId: z.uuid("Choose a team member"),
  role: text(80),
});

export const expenseSchema = z.object({
  eventId: z.uuid(),
  category: z.enum(expenseCategories, { error: "Choose a category" }),
  amountAed: aedField.refine((f) => f > 0, "Enter an amount above 0"),
  incurredOn: date("Choose the date"),
  note: text(500),
  receiptPath: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
});

export const documentSchema = z.object({
  eventId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  storagePath: z.string().trim().min(1).max(400),
  mime: z.string().max(200).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
});

/** Allowed uploads (must match the `event-docs` bucket in the migration). */
export const EVENT_DOC_MAX_BYTES = 10 * 1024 * 1024;
export const EVENT_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];
export const RECEIPT_TYPES = EVENT_DOC_TYPES.filter(
  (t) => t === "application/pdf" || t.startsWith("image/"),
);

/** Object path inside the bucket: `<eventId>/<kind>/<uuid>.<ext>`. */
export function eventObjectPath(
  eventId: string,
  kind: "docs" | "receipts",
  fileName: string,
  id: string,
) {
  const ext =
    fileName
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "bin";
  return `${eventId}/${kind}/${id}.${ext}`;
}

export function isEventObjectPath(eventId: string, kind: "docs" | "receipts", path: string) {
  return new RegExp(`^${eventId}/${kind}/[0-9a-f-]{36}\\.[a-z0-9]{1,8}$`).test(path);
}

// ─── Stock allocation & close-out ─────────────────────────────────────────────────────────

const qty = z.coerce.number().int("Whole units only").min(0, "Can't be negative").max(100000);

export const allocateSchema = z.object({
  eventId: z.uuid(),
  lines: z
    .array(z.object({ variantId: z.uuid(), qty }))
    .transform((ls) => ls.filter((l) => l.qty > 0))
    .refine((ls) => ls.length > 0, "Enter a quantity for at least one product")
    .refine((ls) => new Set(ls.map((l) => l.variantId)).size === ls.length, "Each product once"),
});

export type CloseOutRow = { variantId: string; remaining: number };
export type CloseOutEntry = { variantId: string; returning: number; reason?: string };
export type CloseOutPlan = {
  returns: { variant_id: string; qty: number }[];
  damages: { variant_id: string; qty: number; reason: string }[];
  returned: number;
  damaged: number;
  errors: Record<string, string>;
};

export const DEFAULT_BREAKAGE_REASON = "Broken at event";

/**
 * What the close-out sends to `close_event_stock`: for each variant still at the event, the
 * units coming back and the rest recorded as breakage (needs `returning ≤ remaining`).
 */
export function planCloseOut(rows: CloseOutRow[], entries: CloseOutEntry[]): CloseOutPlan {
  const byId = new Map(entries.map((e) => [e.variantId, e]));
  const plan: CloseOutPlan = { returns: [], damages: [], returned: 0, damaged: 0, errors: {} };
  for (const row of rows) {
    const remaining = Math.max(0, row.remaining);
    if (remaining === 0) continue;
    const entry = byId.get(row.variantId);
    const returning = entry ? entry.returning : remaining;
    if (!Number.isInteger(returning) || returning < 0) {
      plan.errors[row.variantId] = "Enter whole units";
      continue;
    }
    if (returning > remaining) {
      plan.errors[row.variantId] = `Only ${remaining} left at the event`;
      continue;
    }
    if (returning > 0) plan.returns.push({ variant_id: row.variantId, qty: returning });
    const broken = remaining - returning;
    if (broken > 0)
      plan.damages.push({
        variant_id: row.variantId,
        qty: broken,
        reason: entry?.reason?.trim() || DEFAULT_BREAKAGE_REASON,
      });
    plan.returned += returning;
    plan.damaged += broken;
  }
  return plan;
}

export const closeOutSchema = z.object({
  eventId: z.uuid(),
  toLocationId: z.uuid().optional(),
  entries: z.array(
    z.object({
      variantId: z.uuid(),
      returning: z.coerce.number().int("Whole units only").min(0),
      reason: z.string().trim().max(200).optional(),
    }),
  ),
});
