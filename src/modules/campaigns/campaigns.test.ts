import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/modules/notifications/render";
import { unsubscribeToken, verifyUnsubscribeToken } from "./links";
import { readyToSend, rulesSummary, rulesToForm, segmentFormSchema, withFooter } from "./schema";

const capri = "0d0a2f0c-1111-4a4a-8b8b-000000000001";

describe("segmentFormSchema", () => {
  it("turns the form into stored rules, leaving out empty ones", () => {
    const r = segmentFormSchema.parse({
      name: " Big spenders ",
      minSpent: "500",
      maxSpent: "",
      purchasedWithinDays: "30",
      destinationIds: [capri],
      passport: "reward",
      emirates: ["dubai"],
      consent: "on",
    });
    expect(r.name).toBe("Big spenders");
    expect(r.rules).toEqual({
      min_spent_fils: 50_000,
      purchased_within_days: 30,
      destination_ids: [capri],
      passport: "reward",
      emirates: ["dubai"],
      consent: "opted_in",
    });
  });

  it("refuses contradictions", () => {
    expect(
      segmentFormSchema.safeParse({ name: "x", minSpent: "500", maxSpent: "100" }).success,
    ).toBe(false);
    expect(
      segmentFormSchema.safeParse({ name: "x", purchasedWithinDays: "30", notPurchasedDays: "90" })
        .success,
    ).toBe(false);
  });

  it("round-trips through the form values", () => {
    const rules = { min_spent_fils: 50_000, not_purchased_days: 90, passport: "none" as const };
    const back = segmentFormSchema.parse({ name: "x", ...rulesToForm(rules) });
    expect(back.rules).toEqual(rules);
  });
});

describe("rulesSummary", () => {
  it("reads the rules as a line", () => {
    const names = new Map([[capri, "Capri"]]);
    expect(rulesSummary({}, names)).toBe("Every customer");
    expect(
      rulesSummary(
        { min_spent_fils: 50_000, destination_ids: [capri], consent: "opted_in" },
        names,
      ),
    ).toBe("Spent AED 500+ · Capri · agreed to marketing");
  });
});

describe("campaign email", () => {
  it("always ends with the recipient's own unsubscribe link", () => {
    const out = renderTemplate(
      { subject: "Hello {{first_name}}", body: withFooter("New scents, {{first_name}}.") },
      { first_name: "Layla", unsubscribe_link: "https://solei.test/unsubscribe?c=1&t=2" },
    );
    expect(out.subject).toBe("Hello Layla");
    expect(out.html).toContain('href="https://solei.test/unsubscribe?c=1&amp;t=2"');
    expect(out.text).toContain("Unsubscribe");
  });

  it("is ready when it has a segment, subject and message", () => {
    expect(readyToSend({ subject: "", body: "x", segmentId: "s" })).toMatch(/subject/);
    expect(readyToSend({ subject: "x", body: "x", segmentId: null })).toMatch(/goes to/);
    expect(readyToSend({ subject: "x", body: "x", segmentId: "s" })).toBeNull();
  });
});

describe("unsubscribe links", () => {
  it("only verify for their own customer", () => {
    const t = unsubscribeToken("a", "secret");
    expect(verifyUnsubscribeToken("a", t, "secret")).toBe(true);
    expect(verifyUnsubscribeToken("b", t, "secret")).toBe(false);
    expect(verifyUnsubscribeToken("a", "x", "secret")).toBe(false);
  });
});
