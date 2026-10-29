import { describe, expect, it } from "vitest";
import { feedbackToken, verifyFeedbackToken } from "./links";
import {
  automationSettingsSchema,
  digestLines,
  eventDatesText,
  feedbackAnswerSchema,
  shiftTimeText,
} from "./schema";

const ORDER = "6f1c2f8e-7a43-4c55-9d1e-0b5a3c2d1e0f";

describe("feedback links", () => {
  it("verify only for the same order and purpose", () => {
    const t = feedbackToken(ORDER, "answer", "s3cret");
    expect(verifyFeedbackToken(ORDER, "answer", t, "s3cret")).toBe(true);
    expect(verifyFeedbackToken(ORDER, "stop", t, "s3cret")).toBe(false);
    expect(verifyFeedbackToken(ORDER, "answer", t, "other")).toBe(false);
    expect(verifyFeedbackToken(ORDER, "answer", "nope", "s3cret")).toBe(false);
  });
});

describe("feedback answer", () => {
  const base = { orderId: ORDER, token: "t" };
  it("needs a rating or a message", () => {
    expect(feedbackAnswerSchema.safeParse({ ...base, rating: "", message: "" }).success).toBe(
      false,
    );
    expect(feedbackAnswerSchema.parse({ ...base, rating: "5", message: "" })).toMatchObject({
      rating: 5,
      kind: "other",
    });
    expect(
      feedbackAnswerSchema.parse({ ...base, rating: "", kind: "complaint", message: "Late" }),
    ).toMatchObject({ rating: null, message: "Late" });
  });
  it("refuses ratings outside 1–5", () => {
    expect(feedbackAnswerSchema.safeParse({ ...base, rating: "6" }).success).toBe(false);
  });
});

describe("automation settings", () => {
  it("parses the form", () => {
    expect(
      automationSettingsSchema.parse({
        feedbackEnabled: "on",
        feedbackDays: "3",
        staffReminderHours: "24",
      }),
    ).toEqual({
      feedbackEnabled: true,
      feedbackDays: 3,
      staffRemindersEnabled: false,
      staffReminderHours: 24,
      ownerDigestEnabled: false,
    });
    expect(
      automationSettingsSchema.safeParse({ feedbackDays: "0", staffReminderHours: "24" }).success,
    ).toBe(false);
  });
});

describe("email text", () => {
  it("formats event dates and shift times in UAE time", () => {
    expect(eventDatesText("2026-11-01", "2026-11-01")).toBe("Sun 1 Nov");
    expect(eventDatesText("2026-11-01", "2026-11-03")).toBe("Sun 1 Nov – Tue 3 Nov");
    expect(shiftTimeText("2026-11-01T06:00:00Z", "2026-11-01T14:30:00Z")).toBe("10:00–18:30");
  });

  it("lists the digest", () => {
    expect(digestLines([])).toBe("No events in the next 7 days.");
    expect(
      digestLines([
        {
          name: "Galleria pop-up",
          startDate: "2026-11-01",
          endDate: "2026-11-02",
          location: "The Galleria",
          staff: ["Mariam", "Omar"],
        },
      ]),
    ).toBe("- **Galleria pop-up** — Sun 1 Nov – Mon 2 Nov, The Galleria. Staff: Mariam, Omar.");
  });
});
