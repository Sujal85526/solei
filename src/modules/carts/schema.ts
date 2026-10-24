import { z } from "zod";
import { lineOptionsSchema } from "@/modules/catalog/options";

/** Owner rules for bag reminders (Admin → Abandoned carts → Settings). */
export type CartReminderSettings = {
  enabled: boolean;
  firstHours: number;
  /** null = one reminder only. */
  secondHours: number | null;
};

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

const hours = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (!Number.isSafeInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Whole hours, ${min} to ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const cartReminderSettingsSchema = z
  .object({
    enabled: checkbox,
    firstHours: hours(1, 168),
    secondHours: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .pipe(hours(2, 720).nullable()),
  })
  .refine((v) => v.secondHours === null || v.secondHours > v.firstHours, {
    path: ["secondHours"],
    message: "Must be later than the first reminder",
  });

/** Lines as stored / synced. */
export const savedLinesSchema = z
  .array(
    z.object({
      variantId: z.uuid(),
      qty: z.number().int().min(1).max(99),
      options: lineOptionsSchema.optional(),
    }),
  )
  .max(50);

export type CartRowStatus =
  "active" | "abandoned" | "reminded" | "recovered" | "converted" | "emptied";

export const CART_STATUS_LABELS: Record<CartRowStatus, string> = {
  active: "Shopping",
  abandoned: "Left",
  reminded: "Reminded",
  recovered: "Recovered",
  converted: "Bought",
  emptied: "Emptied",
};

/** What staff see for a bag, from its stored status, reminders and idle time. */
export function cartRowStatus(
  c: { status: "open" | "converted" | "emptied"; remindersSent: number; updatedAt: string },
  firstHours: number,
  now = new Date(),
): CartRowStatus {
  if (c.status === "converted") return c.remindersSent > 0 ? "recovered" : "converted";
  if (c.status === "emptied") return "emptied";
  if (c.remindersSent > 0) return "reminded";
  const idleHours = (now.getTime() - new Date(c.updatedAt).getTime()) / 3_600_000;
  return idleHours >= firstHours ? "abandoned" : "active";
}

/** "after 4 hours" / "after 2 days". */
export function hoursText(h: number): string {
  if (h % 24 === 0) return `${h / 24} day${h === 24 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"}`;
}
