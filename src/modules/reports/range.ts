/**
 * Date ranges for the business report: presets on Asia/Dubai business days, the previous
 * period of equal length to compare with, and the bucket size for the sales chart.
 * All days are `YYYY-MM-DD`; the arithmetic runs on UTC midnights so it never shifts a day.
 */
import { businessDay } from "@/lib/dates";

export const RANGE_PRESETS = ["today", "week", "month", "last_month", "year", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  year: "This year",
  custom: "Custom",
};

/** Same cap as the exports and the database function. */
export const MAX_REPORT_DAYS = 366;

export type DayRange = { from: string; to: string };
export type ReportRange = DayRange & { preset: RangePreset };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 86_400_000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => iso(ms(day) + n * MS_DAY);

/** Days in a range, both ends included. */
export const rangeDays = (r: DayRange) => Math.round((ms(r.to) - ms(r.from)) / MS_DAY) + 1;

/** Monday of the ISO week of a day. */
export function weekStart(day: string): string {
  const dow = new Date(ms(day)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export function presetRange(preset: Exclude<RangePreset, "custom">, today: string): DayRange {
  const month = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: weekStart(today), to: today };
    case "month":
      return { from: month, to: today };
    case "last_month": {
      const end = addDays(month, -1);
      return { from: `${end.slice(0, 8)}01`, to: end };
    }
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/**
 * `?range=` preset, or `?from=&to=` for a custom range (swapped if reversed, clamped to
 * MAX_REPORT_DAYS ending at `to`). Defaults to this month.
 */
export function parseReportRange(
  sp: Record<string, string | string[] | undefined>,
  today: string = businessDay(),
): ReportRange {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const pick = (k: string) => {
    const v = one(k);
    return v && DAY.test(v) && !Number.isNaN(ms(v)) ? v : null;
  };
  const preset = one("range") as RangePreset | undefined;
  let from = pick("from");
  let to = pick("to");
  if (preset && preset !== "custom" && RANGE_PRESETS.includes(preset)) {
    return { preset, ...presetRange(preset, today) };
  }
  if (!from && !to) return { preset: "month", ...presetRange("month", today) };
  from ??= to!;
  to ??= from;
  if (from > to) [from, to] = [to, from];
  const earliest = addDays(to, -(MAX_REPORT_DAYS - 1));
  if (from < earliest) from = earliest;
  return { preset: "custom", from, to };
}

/** The same number of days straight before the range (e.g. this month so far → the days before). */
export function previousRange(r: DayRange): DayRange {
  const n = rangeDays(r);
  return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
}

export type Bucket = "day" | "week" | "month";

/** Chart buckets: days up to a month, weeks up to a quarter, months beyond. */
export function bucketFor(r: DayRange): Bucket {
  const n = rangeDays(r);
  if (n <= 31) return "day";
  if (n <= 92) return "week";
  return "month";
}

/** First day of the bucket a day falls in. */
export function bucketStart(day: string, bucket: Bucket): string {
  if (bucket === "week") return weekStart(day);
  if (bucket === "month") return `${day.slice(0, 8)}01`;
  return day;
}

/** Every bucket start touched by the range, in order (empty buckets included). */
export function bucketsOf(r: DayRange, bucket: Bucket): string[] {
  const out: string[] = [];
  let d = bucketStart(r.from, bucket);
  while (d <= r.to) {
    out.push(d);
    if (bucket === "day") d = addDays(d, 1);
    else if (bucket === "week") d = addDays(d, 7);
    else {
      const [y, m] = d.split("-").map(Number);
      d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
  }
  return out;
}

/** "No sales in N days" choices on the stock section; N comes from `?idle=`. */
export const IDLE_DAY_OPTIONS = [30, 60, 90, 180] as const;

export function parseIdleDays(raw: string | string[] | null | undefined): number {
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  return (IDLE_DAY_OPTIONS as readonly number[]).includes(v) ? v : 60;
}
