import { describe, expect, it } from "vitest";
import {
  localTime,
  parseWeek,
  plannedMinutes,
  rotaShiftSchema,
  shiftTimes,
  weekDays,
  weekStart,
} from "./schema";

describe("weeks", () => {
  it("start on Monday", () => {
    expect(weekStart("2026-10-30")).toBe("2026-10-26"); // Friday → Monday
    expect(weekStart("2026-11-01")).toBe("2026-10-26"); // Sunday → same week
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekDays("2026-10-26")).toHaveLength(7);
    expect(weekDays("2026-10-26")[6]).toBe("2026-11-01");
  });
  it("parse the URL, falling back to this week", () => {
    expect(parseWeek("2026-11-04", "2026-10-30")).toBe("2026-11-02");
    expect(parseWeek("junk", "2026-10-30")).toBe("2026-10-26");
  });
});

describe("shift times", () => {
  it("are UAE time", () => {
    const t = shiftTimes("2026-11-01", "10:00", "18:30");
    expect(t).toEqual({ startsAt: "2026-11-01T06:00:00.000Z", endsAt: "2026-11-01T14:30:00.000Z" });
    expect(localTime(t.startsAt)).toBe("10:00");
    expect(plannedMinutes(t)).toBe(510);
  });
  it("roll an early end into the next day", () => {
    const t = shiftTimes("2026-11-01", "18:00", "02:00");
    expect(plannedMinutes(t)).toBe(480);
  });
  it("validate the form", () => {
    const ok = rotaShiftSchema.parse({
      userId: "6f1c2f8e-7a43-4c55-9d1e-0b5a3c2d1e0f",
      day: "2026-11-01",
      start: "09:00",
      end: "17:00",
      eventId: "",
      note: "",
    });
    expect(ok.note).toBe(null);
    expect(ok.eventId).toBe(undefined);
    expect(
      rotaShiftSchema.safeParse({ userId: "x", day: "2026-11-01", start: "9", end: "17:00" })
        .success,
    ).toBe(false);
  });
});
