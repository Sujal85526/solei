import { describe, expect, it } from "vitest";
import {
  applySameHours,
  eventObjectPath,
  eventSchema,
  expenseSchema,
  generateDayRows,
  isEventObjectPath,
  parseDailyHours,
  planCloseOut,
  rowsToDailyHours,
  summariseHours,
} from "./schema";

const base = {
  name: "Abu Dhabi Art Fair",
  type: "exhibition",
  status: "confirmed",
  startDate: "2026-11-20",
  endDate: "2026-11-22",
  feePaymentStatus: "unpaid",
};

describe("daily hours", () => {
  it("generates one row per day of the range", () => {
    const rows = generateDayRows("2026-11-20", "2026-11-22");
    expect(rows.map((r) => r.day)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(rows.every((r) => r.open === "" && r.close === "")).toBe(true);
  });

  it("keeps entered hours and copies the last day's hours onto new days", () => {
    const rows = generateDayRows("2026-11-20", "2026-11-23", {
      "2026-11-20": { open: "10:00", close: "22:00" },
      "2026-11-21": { open: "12:00", close: "23:30" },
    });
    expect(rows).toEqual([
      { day: "2026-11-20", open: "10:00", close: "22:00" },
      { day: "2026-11-21", open: "12:00", close: "23:30" },
      { day: "2026-11-22", open: "12:00", close: "23:30" },
      { day: "2026-11-23", open: "12:00", close: "23:30" },
    ]);
  });

  it("returns no rows for an invalid range", () => {
    expect(generateDayRows("2026-11-22", "2026-11-20")).toEqual([]);
    expect(generateDayRows("", "2026-11-20")).toEqual([]);
  });

  it("applies the same hours to every day and drops empty days when saving", () => {
    const rows = applySameHours(generateDayRows("2026-11-20", "2026-11-21"), {
      open: "09:00",
      close: "21:00",
    });
    expect(rowsToDailyHours(rows)).toEqual({
      "2026-11-20": { open: "09:00", close: "21:00" },
      "2026-11-21": { open: "09:00", close: "21:00" },
    });
    expect(rowsToDailyHours([{ day: "2026-11-20", open: "", close: "" }])).toEqual({});
  });

  it("parses stored JSON defensively", () => {
    expect(
      parseDailyHours({ "2026-11-20": { open: "10:00", close: "22:00" }, junk: { open: 1 } }),
    ).toEqual({ "2026-11-20": { open: "10:00", close: "22:00" } });
    expect(parseDailyHours(null)).toEqual({});
    expect(parseDailyHours([1, 2])).toEqual({});
  });

  it("summarises hours", () => {
    const same = {
      "2026-11-20": { open: "10:00", close: "22:00" },
      "2026-11-21": { open: "10:00", close: "22:00" },
    };
    expect(summariseHours(same, "2026-11-20", "2026-11-21")).toBe("10:00–22:00 daily");
    expect(
      summariseHours(
        { ...same, "2026-11-21": { open: "12:00", close: "22:00" } },
        "2026-11-20",
        "2026-11-21",
      ),
    ).toBe("Varies by day");
    expect(summariseHours({}, "2026-11-20", "2026-11-21")).toBeNull();
  });
});

describe("eventSchema", () => {
  it("parses a full event, converting the fee to fils and the phone to E.164", () => {
    const v = eventSchema.parse({
      ...base,
      organiserPhone: "050 123 4567",
      organiserEmail: "Events@ADNEC.ae",
      emirate: "abu_dhabi",
      feeAed: "1,500.50",
      dailyHours: JSON.stringify([
        { day: "2026-11-20", open: "10:00", close: "22:00" },
        { day: "2026-11-25", open: "10:00", close: "22:00" }, // outside the range → dropped
      ]),
    });
    expect(v.participationFeeFils).toBe(150050);
    expect(v.organiserPhone).toBe("+971501234567");
    expect(v.organiserEmail).toBe("events@adnec.ae");
    expect(v.dailyHours).toEqual({ "2026-11-20": { open: "10:00", close: "22:00" } });
    expect(v.location).toBeNull();
  });

  it("rejects an end date before the start date", () => {
    const r = eventSchema.safeParse({ ...base, endDate: "2026-11-19" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("rejects half-filled hours, bad amounts and bad phones", () => {
    const hours = eventSchema.safeParse({
      ...base,
      dailyHours: JSON.stringify([{ day: "2026-11-20", open: "10:00", close: "" }]),
    });
    expect(hours.success).toBe(false);
    expect(eventSchema.safeParse({ ...base, feeAed: "abc" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, feeAed: "-5" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, organiserPhone: "12" }).success).toBe(false);
  });

  it("defaults an empty fee to 0 and an empty emirate to null", () => {
    const v = eventSchema.parse({ ...base, feeAed: "", emirate: "" });
    expect(v.participationFeeFils).toBe(0);
    expect(v.emirate).toBeNull();
  });
});

describe("expenseSchema", () => {
  const id = "6f1c1f9e-8b1a-4c43-9d2c-1d0f6f0b2a11";
  it("needs a positive amount", () => {
    expect(
      expenseSchema.safeParse({
        eventId: id,
        category: "transport",
        amountAed: "0",
        incurredOn: "2026-11-20",
      }).success,
    ).toBe(false);
    const v = expenseSchema.parse({
      eventId: id,
      category: "transport",
      amountAed: "450",
      incurredOn: "2026-11-20",
    });
    expect(v.amountAed).toBe(45000);
    expect(v.receiptPath).toBeNull();
  });
});

describe("storage paths", () => {
  const id = "6f1c1f9e-8b1a-4c43-9d2c-1d0f6f0b2a11";
  const obj = "0b8f8a52-6d55-4b4f-9a7e-7a3c2a0d9e01";
  it("builds and validates object paths", () => {
    const p = eventObjectPath(id, "receipts", "Van Hire.JPG", obj);
    expect(p).toBe(`${id}/receipts/${obj}.jpg`);
    expect(isEventObjectPath(id, "receipts", p)).toBe(true);
    expect(isEventObjectPath(id, "docs", p)).toBe(false);
    expect(isEventObjectPath(id, "receipts", `../${p}`)).toBe(false);
  });
});

describe("planCloseOut", () => {
  const rows = [
    { variantId: "a", remaining: 15 },
    { variantId: "b", remaining: 4 },
    { variantId: "c", remaining: 0 },
  ];

  it("returns everything by default", () => {
    const plan = planCloseOut(rows, []);
    expect(plan.returns).toEqual([
      { variant_id: "a", qty: 15 },
      { variant_id: "b", qty: 4 },
    ]);
    expect(plan.damages).toEqual([]);
    expect(plan.returned).toBe(19);
  });

  it("records the difference as breakage with a reason", () => {
    const plan = planCloseOut(rows, [
      { variantId: "a", returning: 14, reason: "Dropped tester" },
      { variantId: "b", returning: 0 },
    ]);
    expect(plan.returns).toEqual([{ variant_id: "a", qty: 14 }]);
    expect(plan.damages).toEqual([
      { variant_id: "a", qty: 1, reason: "Dropped tester" },
      { variant_id: "b", qty: 4, reason: "Broken at event" },
    ]);
    expect(plan.returned + plan.damaged).toBe(19);
    expect(plan.errors).toEqual({});
  });

  it("refuses returning more than remains", () => {
    const plan = planCloseOut(rows, [{ variantId: "a", returning: 16 }]);
    expect(plan.errors.a).toMatch(/Only 15/);
    expect(planCloseOut(rows, [{ variantId: "a", returning: -1 }]).errors.a).toBeDefined();
  });
});
