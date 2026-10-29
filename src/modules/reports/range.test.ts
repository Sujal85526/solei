import { describe, expect, it } from "vitest";
import {
  bucketFor,
  bucketsOf,
  parseReportRange,
  presetRange,
  previousRange,
  rangeDays,
  weekStart,
} from "./range";

// 2026-10-30 is a Friday.
const TODAY = "2026-10-30";

describe("report ranges", () => {
  it("presets run on business days", () => {
    expect(presetRange("today", TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(presetRange("week", TODAY)).toEqual({ from: "2026-10-26", to: TODAY });
    expect(presetRange("month", TODAY)).toEqual({ from: "2026-10-01", to: TODAY });
    expect(presetRange("last_month", TODAY)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("year", TODAY)).toEqual({ from: "2026-01-01", to: TODAY });
    expect(presetRange("last_month", "2026-01-15")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("weeks start on Monday", () => {
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday
  });

  it("parses presets, custom days and bad input", () => {
    expect(parseReportRange({}, TODAY)).toEqual({ preset: "month", from: "2026-10-01", to: TODAY });
    expect(parseReportRange({ range: "year" }, TODAY).from).toBe("2026-01-01");
    expect(parseReportRange({ from: "2026-10-20", to: "2026-10-10" }, TODAY)).toEqual({
      preset: "custom",
      from: "2026-10-10",
      to: "2026-10-20",
    });
    expect(parseReportRange({ from: "2026-10-20" }, TODAY)).toMatchObject({
      from: "2026-10-20",
      to: "2026-10-20",
    });
    expect(parseReportRange({ from: "nope", range: "bogus" }, TODAY).preset).toBe("month");
    const long = parseReportRange({ from: "2020-01-01", to: "2026-10-30" }, TODAY);
    expect(rangeDays(long)).toBe(366);
  });

  it("compares with the same number of days just before", () => {
    expect(previousRange({ from: "2026-10-01", to: "2026-10-30" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(previousRange({ from: TODAY, to: TODAY })).toEqual({
      from: "2026-10-29",
      to: "2026-10-29",
    });
  });

  it("picks day, week or month buckets by length", () => {
    expect(bucketFor({ from: "2026-10-01", to: "2026-10-31" })).toBe("day");
    expect(bucketFor({ from: "2026-08-01", to: "2026-10-30" })).toBe("week");
    expect(bucketFor({ from: "2026-01-01", to: "2026-10-30" })).toBe("month");
    expect(bucketsOf({ from: "2026-10-28", to: "2026-10-30" }, "day")).toEqual([
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
    ]);
    expect(bucketsOf({ from: "2026-10-01", to: "2026-10-30" }, "week")[0]).toBe("2026-09-28");
    expect(bucketsOf({ from: "2025-11-15", to: "2026-02-01" }, "month")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });
});
