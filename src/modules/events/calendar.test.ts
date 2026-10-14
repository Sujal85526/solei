import { describe, expect, it } from "vitest";
import {
  addMonths,
  eventsOnDay,
  groupByStartMonth,
  isDay,
  layoutWeek,
  monthWeeks,
  rangesOverlap,
  shiftAnchor,
  viewRange,
  weekDays,
} from "./calendar";

const ev = (id: string, start_date: string, end_date: string) => ({ id, start_date, end_date });

describe("calendar ranges", () => {
  it("validates days", () => {
    expect(isDay("2026-11-01")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("tomorrow")).toBe(false);
  });

  it("builds a Monday-first month grid of whole weeks", () => {
    const weeks = monthWeeks("2026-11-15");
    expect(weeks[0][0]).toBe("2026-10-26"); // 1 Nov 2026 is a Sunday
    expect(weeks.at(-1)?.at(-1)).toBe("2026-12-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(viewRange("month", "2026-11-15")).toEqual({ start: "2026-10-26", end: "2026-12-06" });
  });

  it("week and list ranges", () => {
    expect(weekDays("2026-11-19")).toEqual([
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    expect(viewRange("list", "2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("navigates prev/next", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-11-19", 1)).toBe("2026-11-23");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("overlap", () => {
  it("treats inclusive ranges that touch as overlapping", () => {
    expect(
      rangesOverlap(
        { start: "2026-11-20", end: "2026-11-22" },
        { start: "2026-11-22", end: "2026-11-24" },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { start: "2026-11-20", end: "2026-11-22" },
        { start: "2026-11-23", end: "2026-11-24" },
      ),
    ).toBe(false);
  });

  it("finds events on a day", () => {
    const list = [ev("a", "2026-11-20", "2026-11-22"), ev("b", "2026-11-23", "2026-11-23")];
    expect(eventsOnDay(list, "2026-11-22").map((e) => e.id)).toEqual(["a"]);
  });
});

describe("layoutWeek", () => {
  const week = weekDays("2026-11-16"); // Mon 16 – Sun 22
  it("places multi-day bars in lanes without collisions", () => {
    const segs = layoutWeek(
      [
        ev("long", "2026-11-14", "2026-11-18"),
        ev("mid", "2026-11-17", "2026-11-19"),
        ev("late", "2026-11-19", "2026-11-25"),
        ev("other-week", "2026-11-30", "2026-11-30"),
      ],
      week,
    );
    const by = Object.fromEntries(segs.map((s) => [s.event.id, s]));
    expect(Object.keys(by).sort()).toEqual(["late", "long", "mid"]);
    expect(by.long).toMatchObject({
      col: 0,
      span: 3,
      lane: 0,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(by.mid).toMatchObject({ col: 1, span: 3, lane: 1 });
    // "late" starts on Thu: lane 0 is free from Thu (long ended Wed).
    expect(by.late).toMatchObject({ col: 3, span: 4, lane: 0, continuesAfter: true });
  });
});

describe("groupByStartMonth", () => {
  it("groups and sorts", () => {
    const groups = groupByStartMonth([
      ev("b", "2026-12-01", "2026-12-02"),
      ev("a", "2026-11-20", "2026-11-22"),
      ev("c", "2026-11-02", "2026-11-02"),
    ]);
    expect(groups.map((g) => [g.month, g.events.map((e) => e.id)])).toEqual([
      ["2026-11", ["c", "a"]],
      ["2026-12", ["b"]],
    ]);
  });
});
