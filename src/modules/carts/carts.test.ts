import { describe, expect, it } from "vitest";
import { cartToken, verifyCartToken } from "./links";
import { cartReminderSettingsSchema, cartRowStatus, hoursText } from "./schema";

const id = "6f1c2c1e-6a0e-4b6c-9d55-1b2b3c4d5e6f";

describe("cart links", () => {
  it("verifies a token for its own cart and purpose only", () => {
    const t = cartToken(id, "restore", "s3cret");
    expect(verifyCartToken(id, "restore", t, "s3cret")).toBe(true);
    expect(verifyCartToken(id, "optout", t, "s3cret")).toBe(false);
    expect(verifyCartToken(id, "restore", t, "other")).toBe(false);
    expect(verifyCartToken(id, "restore", "nope", "s3cret")).toBe(false);
  });
});

describe("cartRowStatus", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const base = { status: "open" as const, remindersSent: 0 };
  it("is shopping until the first delay passes, then left", () => {
    expect(cartRowStatus({ ...base, updatedAt: "2026-10-24T10:00:00Z" }, 4, now)).toBe("active");
    expect(cartRowStatus({ ...base, updatedAt: "2026-10-24T07:00:00Z" }, 4, now)).toBe("abandoned");
  });
  it("tells recovered (after a reminder) from a plain purchase", () => {
    const at = "2026-10-24T07:00:00Z";
    expect(cartRowStatus({ status: "open", remindersSent: 1, updatedAt: at }, 4, now)).toBe(
      "reminded",
    );
    expect(cartRowStatus({ status: "converted", remindersSent: 1, updatedAt: at }, 4, now)).toBe(
      "recovered",
    );
    expect(cartRowStatus({ status: "converted", remindersSent: 0, updatedAt: at }, 4, now)).toBe(
      "converted",
    );
  });
});

describe("cartReminderSettingsSchema", () => {
  it("parses hours; empty second = one reminder", () => {
    const r = cartReminderSettingsSchema.safeParse({
      enabled: "on",
      firstHours: "4",
      secondHours: "",
    });
    expect(r.success && r.data).toEqual({ enabled: true, firstHours: 4, secondHours: null });
  });
  it("needs the second reminder after the first", () => {
    expect(
      cartReminderSettingsSchema.safeParse({ firstHours: "24", secondHours: "12" }).success,
    ).toBe(false);
    expect(cartReminderSettingsSchema.safeParse({ firstHours: "0" }).success).toBe(false);
  });
});

describe("hoursText", () => {
  it("reads naturally", () => {
    expect(hoursText(4)).toBe("4 hours");
    expect(hoursText(1)).toBe("1 hour");
    expect(hoursText(24)).toBe("1 day");
    expect(hoursText(48)).toBe("2 days");
  });
});
