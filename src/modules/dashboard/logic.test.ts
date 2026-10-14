import { describe, expect, it } from "vitest";
import { changeBp, formatChange, startsIn } from "./logic";

describe("dashboard logic", () => {
  it("compares with the previous period", () => {
    expect(changeBp(1200, 1000)).toBe(2000);
    expect(changeBp(800, 1000)).toBe(-2000);
    expect(changeBp(5, 0)).toBeNull();
    expect(formatChange(2049)).toBe("+20%");
    expect(formatChange(-2000)).toBe("−20%");
    expect(formatChange(30)).toBe("±0%");
  });

  it("describes when an event starts", () => {
    expect(startsIn("2026-10-14", "2026-10-14", "2026-10-16")).toBe("Today");
    expect(startsIn("2026-10-14", "2026-10-15", "2026-10-15")).toBe("Tomorrow");
    expect(startsIn("2026-10-14", "2026-10-31", "2026-11-01")).toBe("In 17 days");
    expect(startsIn("2026-10-14", "2026-10-12", "2026-10-16")).toBe("On now");
  });
});
