/**
 * All business dates (event days, daily reports, "today's sales") use the Asia/Dubai timezone.
 * The UAE has no DST, but we still go through Intl rather than hard-coding +04:00.
 */

export const BUSINESS_TZ = "Asia/Dubai";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Asia/Dubai calendar date of an instant, as `YYYY-MM-DD` (matches a Postgres `date`). */
export function businessDay(at: Date = new Date()): string {
  return dayFormatter.format(at);
}

/** Offset of the business timezone from UTC at a given instant, in minutes. */
function tzOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** UTC instants bounding a business day `[start, end)`, for range queries on timestamptz columns. */
export function businessDayRange(day: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Invalid business day: ${day}`);
  const [y, m, d] = day.split("-").map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  const offset = tzOffsetMinutes(new Date(midnightUtc));
  const start = new Date(midnightUtc - offset * 60_000);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

/** Inclusive list of business days between two `YYYY-MM-DD` dates (multi-day events). */
export function eachBusinessDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function formatBusinessDate(
  at: Date | string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  const date =
    typeof at === "string" ? new Date(at.length === 10 ? `${at}T12:00:00+04:00` : at) : at;
  return new Intl.DateTimeFormat("en-GB", { timeZone: BUSINESS_TZ, ...opts }).format(date);
}
