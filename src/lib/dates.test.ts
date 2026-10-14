import { describe, expect, it } from "vitest";
import { businessDay, businessDayRange, eachBusinessDay, formatBusinessDate } from "./dates";

describe("dates (Asia/Dubai)", () => {
  it("assigns late-UTC sales to the next Dubai day", () => {
    // 21:30 UTC on 14 Oct = 01:30 on 15 Oct in Dubai
    expect(businessDay(new Date("2026-10-14T21:30:00Z"))).toBe("2026-10-15");
    expect(businessDay(new Date("2026-10-14T19:59:59Z"))).toBe("2026-10-14");
  });

  it("computes the UTC range of a business day", () => {
    const { start, end } = businessDayRange("2026-10-15");
    expect(start.toISOString()).toBe("2026-10-14T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-15T20:00:00.000Z");
    expect(() => businessDayRange("15/10/2026")).toThrow();
  });

  it("lists every day of a multi-day event", () => {
    expect(eachBusinessDay("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("formats dates in the business timezone", () => {
    expect(formatBusinessDate("2026-10-15")).toBe("15 Oct 2026");
  });
});
