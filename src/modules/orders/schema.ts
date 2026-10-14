import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { aedField } from "@/modules/catalog/schema";
import { MANUAL_PAYMENT_METHODS } from "./status";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => v || undefined);

const positiveAmount = aedField.refine((f) => f > 0, "Enter an amount above 0");

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const statusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(["new", "preparing", "dispatched", "delivered", "completed"]),
  note: optionalText(500),
  trackingNumber: optionalText(80),
  courier: optionalText(80),
});

export const paymentSchema = z.object({
  orderId: z.uuid(),
  amount: positiveAmount,
  method: z.enum(MANUAL_PAYMENT_METHODS, "Choose how it was paid"),
  reference: optionalText(120),
  note: optionalText(300),
});

export const refundSchema = z.object({
  orderId: z.uuid(),
  amount: positiveAmount,
  method: z.enum(Constants.public.Enums.payment_method, "Choose how it was refunded"),
  reason: z.string().trim().min(3, "Say why it was refunded").max(500),
});

export const cancelSchema = z.object({
  orderId: z.uuid(),
  reason: z.string().trim().min(3, "Say why the order is cancelled").max(500),
  restock: checkbox,
});

export const notesSchema = z.object({
  orderId: z.uuid(),
  internalNotes: z.string().max(2000, "Keep notes under 2000 characters").default(""),
});

/** List filters from the URL (invalid values are ignored rather than erroring). */
export const orderFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  channel: z.enum(Constants.public.Enums.order_channel).optional().catch(undefined),
  status: z
    .enum([...Constants.public.Enums.order_status, "all"])
    .optional()
    .catch(undefined),
  payment: z.enum(["pending", "partially_paid", "paid", "refunded"]).optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  event: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

/**
 * Search text for the order list: number / name as typed (minus characters that have meaning in
 * PostgREST `or=(…)` filters), plus a phone fragment when the query looks like a phone number —
 * "050 123 4567", "+971 50…" and "00971…" all become "50…" to match stored E.164 numbers.
 */
export function searchNeedles(q: string): { text: string; phone: string | null } {
  const text = q.replace(/[,()*%:"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (/[a-z]/i.test(q)) return { text, phone: null };
  const digits = q.replace(/\D/g, "").replace(/^00/, "").replace(/^971/, "").replace(/^0/, "");
  return { text, phone: digits.length >= 4 ? digits : null };
}
