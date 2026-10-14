import { describe, expect, it } from "vitest";
import {
  adjust,
  awardOrder,
  balanceOf,
  collectedOf,
  emptyCard,
  lineStamps,
  maxRemovable,
  progress,
  progressLabel,
  reverseOrder,
  settle,
  type Card,
  type LoyaltyRule,
  type OrderLineInput,
} from "./engine";

const launch: LoyaltyRule = {
  id: "v1",
  version: 1,
  stampsPerItem: 1,
  qualifyingCategoryIds: [],
  qualifyingProductIds: [],
  stampsForReward: 12,
  rewardType: "choose_from_category",
  rewardLabel: "a free all-over spray of your choice",
  issuePassportAfterPurchases: 2,
  rewardItemsEarnStamps: false,
  expiryMonths: null,
};

let n = 0;
const line = (qty: number, over: Partial<OrderLineInput> = {}): OrderLineInput => ({
  id: `line-${++n}`,
  qty,
  categoryId: "perfume",
  productId: "capri",
  destinationId: "capri",
  isReward: false,
  ...over,
});
const order = (...lines: OrderLineInput[]) => ({ id: `order-${++n}`, lines });

function buy(card: Card, qtys: number[], rule = launch) {
  for (const q of qtys) card = awardOrder(card, rule, true, order(line(q))).card;
  return card;
}

describe("loyalty engine", () => {
  it("accumulates stamps across orders (1 + 1 + 2 + 3 + 5)", () => {
    const steps: number[] = [];
    let card = emptyCard();
    for (const q of [1, 1, 2, 3]) {
      card = buy(card, [q]);
      steps.push(balanceOf(card.entries));
    }
    expect(steps).toEqual([1, 2, 4, 7]);
    const last = awardOrder(card, launch, true, order(line(5)));
    // 7 + 5 = 12 → one reward, nothing carried.
    expect(last.unlocked).toHaveLength(1);
    expect(balanceOf(last.card.entries)).toBe(0);
    expect(collectedOf(last.card.entries)).toBe(12);
  });

  it("crosses a threshold inside one order (11 + 3 → 1 reward, 2 carried)", () => {
    let card = adjust(emptyCard(), 11, launch, true).card;
    const r = awardOrder(card, launch, true, order(line(3)));
    card = r.card;
    expect(r.awarded).toBe(3);
    expect(r.unlocked).toHaveLength(1);
    expect(balanceOf(card.entries)).toBe(2);
    expect(card.rewards.map((x) => x.status)).toEqual(["available"]);
  });

  it("unlocks several rewards when one order crosses several thresholds", () => {
    const r = awardOrder(emptyCard(), launch, true, order(line(20), line(5)));
    expect(r.unlocked).toHaveLength(2);
    expect(balanceOf(r.card.entries)).toBe(1);
  });

  it("stamps per item multiply quantity and each line keeps its destination", () => {
    const rule = { ...launch, stampsPerItem: 2 };
    const r = awardOrder(
      emptyCard(),
      rule,
      true,
      order(line(2, { destinationId: "capri" }), line(1, { destinationId: "soho" })),
    );
    expect(r.awarded).toBe(6);
    expect(r.card.entries.map((e) => [e.destinationId, e.stamps])).toEqual([
      ["capri", 4],
      ["soho", 2],
    ]);
  });

  it("is idempotent per order line", () => {
    const o = order(line(2));
    const once = awardOrder(emptyCard(), launch, true, o).card;
    const twice = awardOrder(once, launch, true, o);
    expect(twice.awarded).toBe(0);
    expect(balanceOf(twice.card.entries)).toBe(2);
  });

  it("reverses an order's stamps once on cancellation", () => {
    let card = buy(emptyCard(), [2]);
    const o = order(line(3));
    card = awardOrder(card, launch, true, o).card;
    expect(balanceOf(card.entries)).toBe(5);
    const r = reverseOrder(card, o.id, { restoreRewards: true, rule: launch, enabled: true });
    expect(r.reversed).toBe(3);
    expect(balanceOf(r.card.entries)).toBe(2);
    const again = reverseOrder(r.card, o.id, { restoreRewards: true, rule: launch, enabled: true });
    expect(again.reversed).toBe(0);
  });

  it("withdraws an unused reward when its stamps are reversed", () => {
    let card = adjust(emptyCard(), 11, launch, true).card;
    const o = order(line(3));
    card = awardOrder(card, launch, true, o).card;
    expect(card.rewards[0].status).toBe("available");
    const r = reverseOrder(card, o.id, { restoreRewards: true, rule: launch, enabled: true });
    expect(r.card.rewards[0].status).toBe("revoked");
    expect(balanceOf(r.card.entries)).toBe(11);
  });

  it("keeps a redeemed reward; the card goes negative and later stamps fill it", () => {
    let card = adjust(emptyCard(), 11, launch, true).card;
    const o = order(line(1));
    card = awardOrder(card, launch, true, o).card;
    card = {
      ...card,
      rewards: card.rewards.map((x) => ({ ...x, status: "redeemed", redeemedOrderId: "gift" })),
    };
    card = reverseOrder(card, o.id, { restoreRewards: false, rule: launch, enabled: true }).card;
    expect(balanceOf(card.entries)).toBe(-1);
    expect(progress(balanceOf(card.entries), 12).collected).toBe(0);
    card = buy(card, [3]);
    expect(balanceOf(card.entries)).toBe(2);
  });

  it("gives a reward back when the order it was redeemed on is cancelled", () => {
    let card = buy(emptyCard(), [12]);
    card = {
      ...card,
      rewards: card.rewards.map((x) => ({ ...x, status: "redeemed", redeemedOrderId: "gift" })),
    };
    const r = reverseOrder(card, "gift", { restoreRewards: true, rule: launch, enabled: true });
    expect(r.card.rewards[0].status).toBe("available");
  });

  it("applies a rule change going forward and keeps earned stamps", () => {
    let card = buy(emptyCard(), [3, 2]);
    expect(balanceOf(card.entries)).toBe(5);
    const v2: LoyaltyRule = {
      ...launch,
      id: "v2",
      version: 2,
      stampsPerItem: 2,
      stampsForReward: 10,
    };
    const r = awardOrder(card, v2, true, order(line(2)));
    card = r.card;
    // 5 old + 4 new = 9: not yet 10.
    expect(balanceOf(card.entries)).toBe(9);
    expect(card.entries.filter((e) => e.kind === "earned").map((e) => e.ruleVersionId)).toEqual([
      "v1",
      "v1",
      "v2",
    ]);
    const next = awardOrder(card, v2, true, order(line(1)));
    expect(next.unlocked[0].stampsCost).toBe(10);
    expect(balanceOf(next.card.entries)).toBe(1);
  });

  it("does not stamp reward items unless the rule says so", () => {
    const reward = line(1, { isReward: true });
    expect(lineStamps(launch, reward)).toBe(0);
    expect(lineStamps({ ...launch, rewardItemsEarnStamps: true }, reward)).toBe(1);
    const r = awardOrder(emptyCard(), launch, true, order(reward, line(1)));
    expect(r.awarded).toBe(1);
  });

  it("only stamps qualifying categories or products when the rule lists them", () => {
    const rule = { ...launch, qualifyingCategoryIds: ["perfume"], qualifyingProductIds: ["oud"] };
    expect(lineStamps(rule, line(1, { categoryId: "perfume" }))).toBe(1);
    expect(lineStamps(rule, line(1, { categoryId: "dukhoon", productId: "oud" }))).toBe(1);
    expect(lineStamps(rule, line(1, { categoryId: "dukhoon", productId: "amber" }))).toBe(0);
  });

  it("auto-issues the passport after two purchases (reward-only orders don't count)", () => {
    let card = emptyCard();
    card = awardOrder(card, launch, true, order(line(1))).card;
    expect(card.passport).toBeNull();
    card = awardOrder(card, launch, true, order(line(1, { isReward: true }))).card;
    expect(card.passport).toBeNull();
    const second = awardOrder(card, launch, true, order(line(1)));
    expect(second.passportIssued).toBe(true);
    expect(second.card.passport).toBe("auto");
    const onRequestOnly = awardOrder(
      emptyCard(),
      { ...launch, issuePassportAfterPurchases: null },
      true,
      order(line(1)),
    );
    expect(onRequestOnly.card.passport).toBeNull();
  });

  it("awards nothing while the programme is off", () => {
    const r = awardOrder(emptyCard(), launch, false, order(line(5)));
    expect(r.awarded).toBe(0);
    expect(settle(adjust(emptyCard(), 20, launch, false).card, launch, false).unlocked).toEqual([]);
  });

  it("limits manual removals to the card plus unused rewards", () => {
    const card = adjust(emptyCard(), 14, launch, true).card;
    expect(maxRemovable(card)).toBe(14);
    expect(() => adjust(card, -15, launch, true)).toThrow(/only 14/);
    const after = adjust(card, -5, launch, true).card;
    // 2 − 5 = −3 → the unused reward is withdrawn: 9 left.
    expect(after.rewards[0].status).toBe("revoked");
    expect(balanceOf(after.entries)).toBe(9);
  });

  it("formats progress like the passport", () => {
    const p = progress(8, 12);
    expect(p).toEqual({ collected: 8, total: 12, remaining: 4 });
    expect(progressLabel(p, "your free spray")).toBe("8 / 12 — 4 more to your free spray");
  });
});
