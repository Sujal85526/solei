import { describe, expect, it } from "vitest";
import {
  birthdayDiscountText,
  birthdaySchema,
  multiplierText,
  pointsForOrder,
  rewardsSettingsSchema,
  tiersSchema,
} from "./schema";

describe("pointsForOrder", () => {
  it("takes as many whole points as fit in what's due", () => {
    // 780 points at 5 fils: AED 39 — the order is AED 310.
    expect(pointsForOrder(780, 31_000, 5, 200)).toBe(780);
    // Only AED 5 due → 100 points fit, below the minimum of 200 → none.
    expect(pointsForOrder(780, 500, 5, 200)).toBe(0);
    // Big balance, small order: capped by what's due.
    expect(pointsForOrder(100_000, 31_000, 5, 200)).toBe(6_200);
  });
  it("needs the minimum balance", () => {
    expect(pointsForOrder(150, 31_000, 5, 200)).toBe(0);
  });
});

describe("rewardsSettingsSchema", () => {
  it("reads the point value in AED", () => {
    const r = rewardsSettingsSchema.parse({
      enabled: "on",
      pointsPerAed: "1",
      pointValue: "0.05",
      minRedeemPoints: "200",
      birthdayEnabled: "on",
      birthdayPoints: "250",
    });
    expect(r).toEqual({
      enabled: true,
      pointsPerAed: 1,
      pointValue: 5,
      minRedeemPoints: 200,
      birthdayEnabled: true,
      birthdayPoints: 250,
      birthdayReward: "points",
      birthdayCodePercentBp: null,
      birthdayCodeAmountFils: null,
      birthdayCodeValidDays: 30,
      birthdayCodeMinOrderFils: null,
    });
  });
  it("refuses fractions of a fils", () => {
    expect(
      rewardsSettingsSchema.safeParse({
        pointsPerAed: "1",
        pointValue: "0.005",
        minRedeemPoints: "1",
        birthdayPoints: "1",
      }).success,
    ).toBe(false);
  });
});

describe("rewardsSettingsSchema · birthday code", () => {
  const base = {
    pointsPerAed: "1",
    pointValue: "0.05",
    minRedeemPoints: "200",
    birthdayEnabled: "on",
    birthdayPoints: "250",
  };
  it("reads a % code with days and a minimum order", () => {
    const r = rewardsSettingsSchema.parse({
      ...base,
      birthdayReward: "both",
      birthdayCodeKind: "percent",
      birthdayCodeValue: "12.5",
      birthdayCodeValidDays: "14",
      birthdayCodeMinOrder: "150",
    });
    expect(r).toMatchObject({
      birthdayReward: "both",
      birthdayCodePercentBp: 1250,
      birthdayCodeAmountFils: null,
      birthdayCodeValidDays: 14,
      birthdayCodeMinOrderFils: 15_000,
    });
  });
  it("reads an AED code, no minimum", () => {
    const r = rewardsSettingsSchema.parse({
      ...base,
      birthdayReward: "code",
      birthdayCodeKind: "amount",
      birthdayCodeValue: "50",
      birthdayCodeValidDays: "30",
      birthdayCodeMinOrder: "",
    });
    expect(r).toMatchObject({
      birthdayCodePercentBp: null,
      birthdayCodeAmountFils: 5_000,
      birthdayCodeMinOrderFils: null,
    });
  });
  it("needs a code value when the reward has a code", () => {
    const r = rewardsSettingsSchema.safeParse({ ...base, birthdayReward: "code" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["birthdayCodeValue"]);
    // Points only: an empty value is fine (the stored one is kept).
    expect(rewardsSettingsSchema.safeParse({ ...base, birthdayReward: "points" }).success).toBe(
      true,
    );
  });
  it("refuses bad values, days and minimums", () => {
    const code = { ...base, birthdayReward: "code", birthdayCodeKind: "percent" };
    expect(rewardsSettingsSchema.safeParse({ ...code, birthdayCodeValue: "0" }).success).toBe(
      false,
    );
    expect(rewardsSettingsSchema.safeParse({ ...code, birthdayCodeValue: "101" }).success).toBe(
      false,
    );
    expect(rewardsSettingsSchema.safeParse({ ...code, birthdayCodeValue: "1.234" }).success).toBe(
      false,
    );
    const ok = { ...code, birthdayCodeValue: "15" };
    expect(rewardsSettingsSchema.safeParse({ ...ok, birthdayCodeValidDays: "0" }).success).toBe(
      false,
    );
    expect(rewardsSettingsSchema.safeParse({ ...ok, birthdayCodeValidDays: "366" }).success).toBe(
      false,
    );
    expect(rewardsSettingsSchema.safeParse({ ...ok, birthdayCodeMinOrder: "abc" }).success).toBe(
      false,
    );
    expect(rewardsSettingsSchema.safeParse({ ...ok, birthdayReward: "cake" }).success).toBe(false);
  });
});

describe("birthdayDiscountText", () => {
  it("says % or AED off", () => {
    expect(birthdayDiscountText(1500, null)).toBe("15% off");
    expect(birthdayDiscountText(1250, null)).toBe("12.5% off");
    expect(birthdayDiscountText(null, 5_000)).toBe("AED 50 off");
  });
});

describe("tiersSchema", () => {
  const row = (name: string, minSpend: string, multiplier = "1") => ({
    name,
    minSpend,
    multiplier,
    perks: "",
  });
  it("sorts by spend and converts units", () => {
    const r = tiersSchema.parse([row("Voyager", "1000", "1.25"), row("Explorer", "0")]);
    expect(r.map((t) => [t.name, t.minSpend, t.multiplier])).toEqual([
      ["Explorer", 0, 10_000],
      ["Voyager", 100_000, 12_500],
    ]);
  });
  it("needs a tier from AED 0 and distinct spends", () => {
    expect(tiersSchema.safeParse([row("A", "100")]).success).toBe(false);
    expect(tiersSchema.safeParse([row("A", "0"), row("B", "0")]).success).toBe(false);
    expect(tiersSchema.safeParse([row("A", "0", "0.5")]).success).toBe(false);
  });
});

describe("birthdaySchema", () => {
  it("takes day + month, or nothing", () => {
    expect(birthdaySchema.parse({ month: "2", day: "29" })).toEqual({ month: 2, day: 29 });
    expect(birthdaySchema.parse({ month: "0", day: "0" })).toBeNull();
    expect(birthdaySchema.safeParse({ month: "4", day: "31" }).success).toBe(false);
    expect(birthdaySchema.safeParse({ month: "4", day: "0" }).success).toBe(false);
  });
});

describe("multiplierText", () => {
  it("drops trailing zeros", () => {
    expect(multiplierText(10_000)).toBe("×1");
    expect(multiplierText(12_500)).toBe("×1.25");
    expect(multiplierText(15_000)).toBe("×1.5");
  });
});
