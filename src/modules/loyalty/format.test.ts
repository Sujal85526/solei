import { describe, expect, it } from "vitest";
import { describeRule, destinationList, signedStamps } from "./format";

describe("loyalty format", () => {
  it("joins destinations for the stamp email", () => {
    expect(destinationList(["Capri"])).toBe("Capri");
    expect(destinationList(["Capri", "Soho", "Capri"])).toBe("Capri and Soho");
    expect(destinationList(["Capri", "Soho", "Monaco"])).toBe("Capri, Soho and Monaco");
    expect(destinationList([])).toBe("a new stamp");
  });

  it("signs ledger amounts", () => {
    expect(signedStamps(3)).toBe("+3");
    expect(signedStamps(-12)).toBe("−12");
  });

  it("describes the launch rule", () => {
    expect(
      describeRule({
        stampsPerItem: 1,
        qualifyingCategoryIds: [],
        qualifyingProductIds: [],
        stampsForReward: 12,
        rewardLabel: "a free all-over spray of your choice",
        issuePassportAfterPurchases: 2,
        rewardItemsEarnStamps: false,
        expiryMonths: null,
      }),
    ).toEqual([
      "1 stamp per item (every product)",
      "12 stamps = a free all-over spray of your choice",
      "Passport after 2 purchases or on request",
      "Reward items don't earn stamps",
      "Stamps never expire",
    ]);
  });
});
