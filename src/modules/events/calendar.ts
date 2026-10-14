/**
 * Pure calendar math on `YYYY-MM-DD` business dates (Asia/Dubai). No Date objects leak out:
 * days are compared as strings, arithmetic is done in UTC so DST can never shift a day.
 */

export const calendarViews = ["month", "week", "list"] as const;
export type CalendarView = (typeof calendarViews)[number];

/** Weeks start on Monday (UAE working week, weekend Sat–Sun). */
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !DAY.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const fromDate = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

export function addMonths(day: string, n: number): string {
  const d = toDate(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  // Clamp to the last day of the target month (31 Jan + 1 month → 28/29 Feb).
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return fromDate(target);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (toDate(day).getUTCDay() + 6) % 7;
}

export function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: string): string {
  return addDays(addMonths(startOfMonth(day), 1), -1);
}

/** Visible range of a view, inclusive. List shows the month too, without padding. */
export function viewRange(view: CalendarView, anchor: string): { start: string; end: string } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }
  if (view === "month") {
    const start = startOfWeek(startOfMonth(anchor));
    const end = addDays(startOfWeek(endOfMonth(anchor)), 6);
    return { start, end };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

/** Anchor date for prev/next. */
export function shiftAnchor(view: CalendarView, anchor: string, dir: -1 | 1): string {
  if (view === "week") return addDays(startOfWeek(anchor), 7 * dir);
  return startOfMonth(addMonths(startOfMonth(anchor), dir));
}

/** Month grid: whole weeks (Mon–Sun) covering the month. */
export function monthWeeks(anchor: string): string[][] {
  const { start, end } = viewRange("month", anchor);
  const weeks: string[][] = [];
  for (let wk = start; wk <= end; wk = addDays(wk, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(wk, i)));
  }
  return weeks;
}

export function weekDays(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export type DatedEvent = { id: string; start_date: string; end_date: string };

/** Inclusive date ranges intersect (an event ending the day another starts overlaps). */
export function rangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
) {
  return a.start <= b.end && b.start <= a.end;
}

export function eventsOnDay<T extends DatedEvent>(events: T[], day: string): T[] {
  return events.filter((e) => e.start_date <= day && e.end_date >= day);
}

export type WeekSegment<T> = {
  event: T;
  /** 0-based column of the first visible day in this week. */
  col: number;
  span: number;
  lane: number;
  /** The event continues before / after this week. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Lays multi-day events out as bars in one week row: each event gets the lowest lane that is
 * free for all its days (longer events first so they stay on top and stable).
 */
export function layoutWeek<T extends DatedEvent>(events: T[], week: string[]): WeekSegment<T>[] {
  const first = week[0];
  const last = week[week.length - 1];
  const visible = events
    .filter((e) =>
      rangesOverlap({ start: e.start_date, end: e.end_date }, { start: first, end: last }),
    )
    .sort(
      (a, b) =>
        a.start_date.localeCompare(b.start_date) ||
        daysBetween(b.start_date, b.end_date) - daysBetween(a.start_date, a.end_date) ||
        a.id.localeCompare(b.id),
    );
  const lanes: boolean[][] = [];
  return visible.map((event) => {
    const from = event.start_date < first ? first : event.start_date;
    const to = event.end_date > last ? last : event.end_date;
    const col = daysBetween(first, from);
    const span = daysBetween(from, to) + 1;
    let lane = 0;
    while (lanes[lane]?.slice(col, col + span).some(Boolean)) lane++;
    lanes[lane] ??= Array(week.length).fill(false);
    for (let i = col; i < col + span; i++) lanes[lane][i] = true;
    return {
      event,
      col,
      span,
      lane,
      continuesBefore: event.start_date < first,
      continuesAfter: event.end_date > last,
    };
  });
}

/** Group events for the list view by month of their first visible day. */
export function groupByStartMonth<T extends DatedEvent>(
  events: T[],
): { month: string; events: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const e of [...events].sort(
    (a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date),
  )) {
    const key = e.start_date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups].map(([month, evs]) => ({ month, events: evs }));
}

export function parseView(v: unknown): CalendarView | undefined {
  return calendarViews.includes(v as CalendarView) ? (v as CalendarView) : undefined;
}
