import { describe, expect, it } from "vitest";
import {
  reportRange,
  hoursDifference,
  salesPerHourFils,
  staffTotals,
  staffWorkbook,
  type StaffPerformanceRow,
} from "./report";

const row = (over: Partial<StaffPerformanceRow>): StaffPerformanceRow => ({
  userId: "u",
  name: "Mariam",
  jobTitle: "Sales",
  active: true,
  orders: 4,
  units: 9,
  salesFils: 120_000,
  workedMinutes: 480,
  shiftsWorked: 1,
  plannedMinutes: 540,
  plannedShifts: 1,
  eventsWorked: 1,
  ...over,
});

describe("staff report", () => {
  it("works out sales per hour and worked − planned", () => {
    expect(salesPerHourFils(row({}))).toBe(15_000);
    expect(salesPerHourFils(row({ workedMinutes: 0 }))).toBe(null);
    expect(hoursDifference(row({}))).toBe(-60);
    expect(hoursDifference(row({ plannedMinutes: 0 }))).toBe(null);
  });

  it("totals, keeping hours hidden when the database hid them", () => {
    const t = staffTotals([row({}), row({ salesFils: 30_000, workedMinutes: 120 })]);
    expect(t).toMatchObject({ orders: 8, salesFils: 150_000, workedMinutes: 600 });
    const hidden = staffTotals([row({ workedMinutes: null, plannedMinutes: null })]);
    expect(hidden.workedMinutes).toBe(null);
    expect(hidden.salesFils).toBe(120_000);
  });

  it("leaves hour columns out of the export without staff.manage", () => {
    const withHours = staffWorkbook([row({})], "2026-10-01", "2026-10-31", true);
    const without = staffWorkbook([row({})], "2026-10-01", "2026-10-31", false);
    const table = (m: typeof withHours) =>
      m.sheets[0].blocks[0] as { columns: unknown[]; rows: unknown[][] };
    expect(table(withHours).columns).toHaveLength(12);
    expect(table(without).columns).toHaveLength(6);
    expect(table(withHours).rows[0]).toEqual([
      "Mariam",
      "Sales",
      4,
      9,
      120_000,
      8,
      1,
      9,
      1,
      -1,
      15_000,
      1,
    ]);
  });
});

describe("reportRange", () => {
  it("defaults to this month and keeps ranges sane", () => {
    expect(reportRange(null, null, "2026-10-30")).toEqual({ from: "2026-10-01", to: "2026-10-30" });
    expect(reportRange("2026-10-20", "2026-10-01")).toEqual({
      from: "2026-10-01",
      to: "2026-10-20",
    });
    expect(reportRange("2020-01-01", "2026-10-30").from).toBe("2025-10-29");
  });
});
