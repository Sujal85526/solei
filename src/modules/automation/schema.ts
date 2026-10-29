import { z } from "zod";
import { formatBusinessDate } from "@/lib/dates";

/**
 * Automatic emails: feedback requests after delivery, staff reminders before events and shifts,
 * the owner's upcoming-events digest, and event news sign-ups. Settings live in `settings`
 * (owner-editable in Admin → Customers → Labels & emails).
 */
export type AutomationSettings = {
  feedbackEnabled: boolean;
  /** Days after delivery. */
  feedbackDays: number;
  staffRemindersEnabled: boolean;
  /** Hours before the event opens / the shift starts. */
  staffReminderHours: number;
  ownerDigestEnabled: boolean;
};

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

const whole = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = Number(v);
      if (!v || !Number.isSafeInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label}, ${min} to ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const automationSettingsSchema = z.object({
  feedbackEnabled: checkbox,
  feedbackDays: whole("Whole days", 1, 60),
  staffRemindersEnabled: checkbox,
  staffReminderHours: whole("Whole hours", 1, 168),
  ownerDigestEnabled: checkbox,
});

/** Feedback page: the customer's answer. */
export const feedbackAnswerSchema = z
  .object({
    orderId: z.uuid(),
    token: z.string().min(1),
    rating: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().int().min(1).max(5).nullable(),
    ),
    kind: z.enum(["complaint", "suggestion", "compliment", "other"]).default("other"),
    message: z.string().trim().max(2000).default(""),
  })
  .refine((v) => v.rating !== null || v.message, {
    path: ["message"],
    message: "Choose a rating or write a few words",
  });

/** Event news sign-up (events page). */
export const eventNewsSignupSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email("Enter a valid email").max(254),
  ),
  name: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
});

const dayText = (d: string) =>
  formatBusinessDate(d, { weekday: "short", day: "numeric", month: "short" });

/** "Sat 1 Nov" or "Sat 1 – Mon 3 Nov". */
export function eventDatesText(start: string, end: string): string {
  if (start === end) return dayText(start);
  return `${dayText(start)} – ${dayText(end)}`;
}

/** "10:00" in UAE time. */
export const timeText = (iso: string) =>
  formatBusinessDate(iso, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "10:00–18:00" in UAE time. */
export const shiftTimeText = (startsAt: string, endsAt: string) =>
  `${timeText(startsAt)}–${timeText(endsAt)}`;

export type DigestEvent = {
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  staff: string[];
};

/** Lines of the owner's digest (Markdown list). */
export function digestLines(events: DigestEvent[]): string {
  if (!events.length) return "No events in the next 7 days.";
  return events
    .map(
      (e) =>
        `- **${e.name}** — ${eventDatesText(e.startDate, e.endDate)}${e.location ? `, ${e.location}` : ""}. ` +
        (e.staff.length ? `Staff: ${e.staff.join(", ")}.` : "No staff assigned yet."),
    )
    .join("\n");
}
