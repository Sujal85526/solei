import { describe, expect, it } from "vitest";
import {
  currentCardStickers,
  describeRule,
  destinationList,
  destinationTally,
  signedStamps,
} from "./format";

describe("passport stickers", () => {
  const at = (i: number) => `2026-10-${String(i).padStart(2, "0")}T10:00:00Z`;
  const entries = [
    {
      kind: "earned" as const,
      stamps: 2,
      destination: "Capri",
      createdAt: at(1),
      order: { id: "o1" },
    },
    {
      kind: "earned" as const,
      stamps: 1,
      destination: "Soho",
      createdAt: at(2),
      order: { id: "o2" },
    },
    { kind: "manual" as const, stamps: 1, destination: null, createdAt: at(3) },
    {
      kind: "earned" as const,
      stamps: 3,
      destination: "Monaco",
      createdAt: at(4),
      order: { id: "o3" },
    },
    {
      kind: "reversed" as const,
      stamps: -3,
      destination: "Monaco",
      createdAt: at(5),
      order: { id: "o3" },
    },
  ];

  it("shows the latest stamps on the current card, without reversed orders", () => {
    expect(currentCardStickers(entries, 4)).toEqual(["Capri", "Capri", "Soho", null]);
    expect(currentCardStickers(entries, 2)).toEqual(["Soho", null]);
    expect(currentCardStickers(entries, 0)).toEqual([]);
    expect(currentCardStickers(entries, -1)).toEqual([]);
  });

  it("tallies destinations collected", () => {
    expect(destinationTally(entries)).toEqual([
      { name: "Capri", count: 2 },
      { name: "Soho", count: 1 },
    ]);
  });
});

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
