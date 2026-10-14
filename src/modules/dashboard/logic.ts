import type { BasisPoints } from "@/lib/money";

/** Change vs the previous period in basis points; null when there is nothing to compare with. */
export function changeBp(current: number, previous: number): BasisPoints | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) * 10_000) / previous);
}

/** "+12%", "−8%", "±0%" — whole percent, true minus sign. */
export function formatChange(bp: BasisPoints): string {
  const pct = Math.round(bp / 100);
  if (pct === 0) return "±0%";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/** Days from `today` to `start` (both YYYY-MM-DD): "Today", "Tomorrow", "In 5 days", "On now". */
export function startsIn(today: string, start: string, end: string): string {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
  const n = day(start) - day(today);
  if (n < 0) return day(end) >= day(today) ? "On now" : "Ended";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `In ${n} days`;
}
