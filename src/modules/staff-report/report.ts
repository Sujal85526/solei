import { businessDay, formatBusinessDate } from "@/lib/dates";
import type { Cell, Column, WorkbookModel } from "@/modules/reports/tables";

/**
 * Staff performance for a period: sales made (POS / manual orders), hours clocked against hours
 * planned, shifts and events worked. Hours are null for staff without staff.manage (the database
 * leaves them out).
 */
export type StaffPerformanceRow = {
  userId: string;
  name: string;
  jobTitle: string | null;
  active: boolean;
  orders: number;
  units: number;
  salesFils: number;
  workedMinutes: number | null;
  shiftsWorked: number | null;
  plannedMinutes: number | null;
  plannedShifts: number | null;
  eventsWorked: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `?from=&to=` → a valid range (this month so far by default; swapped when reversed; ≤ 1 year). */
export function reportRange(
  rawFrom: unknown,
  rawTo: unknown,
  today = businessDay(),
): { from: string; to: string } {
  const pick = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
  let from = pick(rawFrom) ?? `${today.slice(0, 8)}01`;
  let to = pick(rawTo) ?? today;
  if (from > to) [from, to] = [to, from];
  const yearBefore = new Date(`${to}T12:00:00Z`);
  yearBefore.setUTCDate(yearBefore.getUTCDate() - 366);
  const min = yearBefore.toISOString().slice(0, 10);
  return { from: from < min ? min : from, to };
}

export type StaffTotals = Omit<StaffPerformanceRow, "userId" | "name" | "jobTitle" | "active">;

export function staffTotals(rows: StaffPerformanceRow[]): StaffTotals {
  const sum = (k: keyof StaffTotals) =>
    rows.some((r) => r[k] === null) ? null : rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  return {
    orders: sum("orders") ?? 0,
    units: sum("units") ?? 0,
    salesFils: sum("salesFils") ?? 0,
    workedMinutes: sum("workedMinutes"),
    shiftsWorked: sum("shiftsWorked"),
    plannedMinutes: sum("plannedMinutes"),
    plannedShifts: sum("plannedShifts"),
    eventsWorked: sum("eventsWorked") ?? 0,
  };
}

/** Sales per hour worked, in fils (null without hours). */
export const salesPerHourFils = (r: Pick<StaffPerformanceRow, "salesFils" | "workedMinutes">) =>
  r.workedMinutes ? Math.round((r.salesFils * 60) / r.workedMinutes) : null;

/** Worked − planned, in minutes (null when either is unknown or nothing was planned). */
export const hoursDifference = (
  r: Pick<StaffPerformanceRow, "workedMinutes" | "plannedMinutes">,
) => (r.workedMinutes === null || !r.plannedMinutes ? null : r.workedMinutes - r.plannedMinutes);

const hours = (minutes: number | null) => (minutes === null ? null : Math.round(minutes / 6) / 10);

/** The Excel model: one sheet, a row per person and a total row. */
export function staffWorkbook(
  rows: StaffPerformanceRow[],
  from: string,
  to: string,
  withHours: boolean,
): WorkbookModel {
  const columns: Column[] = [
    { header: "Staff member", format: "text", width: 24 },
    { header: "Position", format: "text", width: 16 },
    { header: "Orders", format: "int" },
    { header: "Units", format: "int" },
    { header: "Sales (AED)", format: "aed", width: 14 },
    ...(withHours
      ? ([
          { header: "Hours worked", format: "dec" },
          { header: "Shifts worked", format: "int" },
          { header: "Hours planned", format: "dec" },
          { header: "Shifts planned", format: "int" },
          { header: "Worked − planned (h)", format: "dec", width: 14 },
          { header: "Sales per hour", format: "aed", width: 14 },
        ] satisfies Column[])
      : []),
    { header: "Events worked", format: "int" },
  ];
  const line = (
    r: StaffPerformanceRow | (StaffTotals & { name: string; jobTitle: null }),
  ): Cell[] => [
    r.name,
    r.jobTitle,
    r.orders,
    r.units,
    r.salesFils,
    ...(withHours
      ? [
          hours(r.workedMinutes),
          r.shiftsWorked,
          hours(r.plannedMinutes),
          r.plannedShifts,
          hours(hoursDifference(r)),
          salesPerHourFils(r),
        ]
      : []),
    r.eventsWorked,
  ];
  const totals = staffTotals(rows);
  return {
    title: "Solei — staff performance",
    subtitle: [
      `${formatBusinessDate(from)} – ${formatBusinessDate(to)}`,
      "Sales = orders they made (POS and manual), after refunds",
    ],
    sheets: [
      {
        name: "Staff",
        blocks: [
          {
            kind: "table",
            columns,
            rows: rows.map(line),
            totals: line({ ...totals, name: "Total", jobTitle: null }),
          },
        ],
      },
    ],
  };
}
