import { z } from "zod";

/** Staff attendance: shifts (clock in / out), hours and the correction form. */

export type Shift = {
  id: string;
  userId: string;
  eventId: string | null;
  eventName: string | null;
  clockIn: string;
  clockOut: string | null;
  note: string | null;
};

/** Minutes worked; an open shift counts up to `now`. */
export function shiftMinutes(s: Pick<Shift, "clockIn" | "clockOut">, now = new Date()): number {
  const end = s.clockOut ? new Date(s.clockOut) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(s.clockIn).getTime()) / 60_000));
}

/** "7 h 30 min" / "45 min" */
export function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Total minutes per person. */
export function totalsByUser(shifts: Shift[], now = new Date()): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of shifts) out.set(s.userId, (out.get(s.userId) ?? 0) + shiftMinutes(s, now));
  return out;
}

/** datetime-local value ("2026-10-24T09:30") in Asia/Dubai → ISO. */
export function dubaiLocalToIso(v: string): string {
  return new Date(`${v}:00+04:00`).toISOString();
}

/** ISO → datetime-local value in Asia/Dubai (UTC+4, no daylight saving). */
export function isoToDubaiLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + 4 * 3_600_000).toISOString().slice(0, 16);
}

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time")
  .transform(dubaiLocalToIso);

/** Owner adds or corrects a shift (times typed in UAE time). */
export const shiftFormSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    userId: z.uuid("Choose who"),
    eventId: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    clockIn: localDateTime,
    clockOut: z
      .string()
      .optional()
      .transform((v) => v || undefined)
      .pipe(localDateTime.optional()),
    note: z.string().trim().max(300).optional().default(""),
  })
  .refine((v) => !v.clockOut || v.clockOut > v.clockIn, {
    path: ["clockOut"],
    message: "Must be after clock-in",
  });
