import { describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_RULES as rules,
  describeLabelRules,
  labelFor,
  labelRulesSchema,
  labelRulesToForm,
} from "./labels";

const now = new Date("2026-10-30T12:00:00Z");
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("labelFor", () => {
  it("gives no label without purchases", () => {
    expect(
      labelFor({ orders: 0, firstAt: null, lastAt: null, recentSpentFils: 0 }, rules, now),
    ).toBe(null);
  });

  it("checks VIP, then inactive, then new, then returning", () => {
    const base = { orders: 3, firstAt: ago(400), lastAt: ago(10), recentSpentFils: 0 };
    expect(labelFor({ ...base, recentSpentFils: 200_000 }, rules, now)).toBe("vip");
    expect(labelFor({ ...base, lastAt: ago(200) }, rules, now)).toBe("inactive");
    expect(labelFor({ ...base, orders: 1, firstAt: ago(5), lastAt: ago(5) }, rules, now)).toBe(
      "new",
    );
    expect(labelFor(base, rules, now)).toBe("returning");
  });

  it("leaves a single older purchase unlabelled until it goes inactive", () => {
    const one = { orders: 1, firstAt: ago(60), lastAt: ago(60), recentSpentFils: 30_000 };
    expect(labelFor(one, rules, now)).toBe(null);
    expect(labelFor({ ...one, firstAt: ago(181), lastAt: ago(181) }, rules, now)).toBe("inactive");
  });

  it("never makes everyone VIP when the threshold is zero", () => {
    expect(
      labelFor(
        { orders: 2, firstAt: ago(90), lastAt: ago(10), recentSpentFils: 0 },
        { ...rules, vipSpendFils: 0 },
        now,
      ),
    ).toBe("returning");
  });
});

describe("label rules form", () => {
  it("round-trips the defaults", () => {
    expect(labelRulesSchema.parse(labelRulesToForm(rules))).toEqual({
      vipSpend: 200_000,
      vipMonths: 12,
      inactiveDays: 180,
      newDays: 30,
      returningOrders: 2,
    });
  });

  it("rejects out-of-range values", () => {
    const r = labelRulesSchema.safeParse({ ...labelRulesToForm(rules), returningOrders: "1" });
    expect(r.success).toBe(false);
    expect(labelRulesSchema.safeParse({ ...labelRulesToForm(rules), vipSpend: "" }).success).toBe(
      false,
    );
  });

  it("describes each label in a line", () => {
    expect(describeLabelRules(rules).vip).toBe("Spent AED 2,000 or more in the last 12 months");
    expect(describeLabelRules(rules).returning).toBe("2 or more purchases");
  });
});
