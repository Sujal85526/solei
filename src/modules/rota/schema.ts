import { z } from "zod";
import { businessDay } from "@/lib/dates";

/** Planned shifts (rota): who works when, optionally at an event. Times are UAE time (UTC+4). */

export type PlannedShift = {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  eventId: string | null;
  eventName: string | null;
  note: string | null;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The Monday of the week holding `day` (a business day, YYYY-MM-DD). */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** The seven days from a Monday. */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export const shiftWeek = (monday: string, weeks: number) => addDays(monday, weeks * 7);

/** `?week=` → that week's Monday, else this week's. */
export function parseWeek(raw: unknown, today = businessDay()): string {
  return weekStart(typeof raw === "string" && DAY.test(raw) ? raw : today);
}

/** Business day of a shift's start (UAE). */
export const shiftDay = (startsAt: string) => businessDay(new Date(startsAt));

/** "10:00" for an ISO time in UAE time. */
export const localTime = (iso: string) =>
  new Date(new Date(iso).getTime() + 4 * 3_600_000).toISOString().slice(11, 16);

/** Day + "HH:MM" in UAE time → ISO; an end at or before the start is the next day (night shift). */
export function shiftTimes(day: string, start: string, end: string) {
  const startsAt = new Date(`${day}T${start}:00+04:00`);
  const endsAt = new Date(`${day}T${end}:00+04:00`);
  if (endsAt <= startsAt) endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

/** Planned minutes of a shift. */
export const plannedMinutes = (s: Pick<PlannedShift, "startsAt" | "endsAt">) =>
  Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60_000);

const optionalUuid = z
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Owner plans or changes a shift. */
export const rotaShiftSchema = z
  .object({
    id: optionalUuid,
    userId: z.uuid("Choose who"),
    day: z.string().regex(DAY, "Pick a day"),
    start: z.string().regex(TIME, "Start time, e.g. 10:00"),
    end: z.string().regex(TIME, "End time, e.g. 18:00"),
    eventId: optionalUuid,
    note: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => v || null),
  })
  .transform((v) => ({ ...v, ...shiftTimes(v.day, v.start, v.end) }));
