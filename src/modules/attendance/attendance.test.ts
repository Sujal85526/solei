import { describe, expect, it } from "vitest";
import {
  dubaiLocalToIso,
  hoursText,
  isoToDubaiLocal,
  shiftFormSchema,
  shiftMinutes,
  totalsByUser,
  type Shift,
} from "./schema";

const shift = (userId: string, clockIn: string, clockOut: string | null): Shift => ({
  id: clockIn,
  userId,
  eventId: null,
  eventName: null,
  clockIn,
  clockOut,
  note: null,
});

describe("attendance", () => {
  it("counts minutes, an open shift up to now", () => {
    expect(shiftMinutes(shift("a", "2026-10-24T05:00:00Z", "2026-10-24T12:30:00Z"))).toBe(450);
    expect(
      shiftMinutes(shift("a", "2026-10-24T05:00:00Z", null), new Date("2026-10-24T06:15:00Z")),
    ).toBe(75);
  });

  it("totals per person", () => {
    const t = totalsByUser([
      shift("a", "2026-10-24T05:00:00Z", "2026-10-24T09:00:00Z"),
      shift("a", "2026-10-25T05:00:00Z", "2026-10-25T06:30:00Z"),
      shift("b", "2026-10-24T05:00:00Z", "2026-10-24T06:00:00Z"),
    ]);
    expect(t.get("a")).toBe(330);
    expect(t.get("b")).toBe(60);
  });

  it("reads hours naturally", () => {
    expect(hoursText(450)).toBe("7 h 30 min");
    expect(hoursText(120)).toBe("2 h");
    expect(hoursText(45)).toBe("45 min");
  });

  it("converts UAE local times both ways", () => {
    expect(dubaiLocalToIso("2026-10-24T09:30")).toBe("2026-10-24T05:30:00.000Z");
    expect(isoToDubaiLocal("2026-10-24T05:30:00.000Z")).toBe("2026-10-24T09:30");
  });

  it("validates the correction form", () => {
    const user = "6f1c2c1e-6a0e-4b6c-9d55-1b2b3c4d5e6f";
    const ok = shiftFormSchema.safeParse({
      userId: user,
      clockIn: "2026-10-24T09:00",
      clockOut: "2026-10-24T17:00",
    });
    expect(ok.success && ok.data.clockOut).toBe("2026-10-24T13:00:00.000Z");
    expect(
      shiftFormSchema.safeParse({
        userId: user,
        clockIn: "2026-10-24T09:00",
        clockOut: "2026-10-24T08:00",
      }).success,
    ).toBe(false);
    expect(shiftFormSchema.safeParse({ userId: user, clockIn: "", clockOut: "" }).success).toBe(
      false,
    );
  });
});
