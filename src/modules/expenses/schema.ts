import { z } from "zod";
import { aedField } from "@/modules/events/schema";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const note = z
  .string()
  .trim()
  .max(500, "Keep it under 500 characters")
  .optional()
  .transform((v) => v || null);

/** A business expense from the form; `id` set = edit. Amount typed in AED → fils. */
export const businessExpenseSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  categoryId: z.uuid({ error: "Choose a category" }),
  amountAed: aedField.refine((f) => f > 0, "Enter an amount above 0"),
  spentOn: z.string({ error: "Choose the date" }).regex(DAY, "Choose the date"),
  note,
});

export const expenseCategorySchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.uuid().nullable()),
  name: z.string().trim().min(1, "Enter a name").max(60, "Keep it under 60 characters"),
});

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** `?month=YYYY-MM` → that month, else the month of `today`. */
export function parseMonth(raw: string | string[] | undefined, today: string): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && MONTH.test(v) ? v : today.slice(0, 7);
}

/** First and last day of a `YYYY-MM` month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** The month before / after a `YYYY-MM` month. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
