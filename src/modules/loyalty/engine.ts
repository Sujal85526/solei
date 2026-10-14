/**
 * Solei Passport rules engine — pure functions that mirror the SQL in
 * `supabase/migrations/20261014400001_loyalty_passport.sql` (loyalty_award_order, loyalty_settle,
 * loyalty_reverse_order, loyalty_adjust_stamps). The database is the source of truth at runtime;
 * this module documents the maths, powers previews/progress copy and is unit-tested.
 *
 * Balance = sum of all ledger entries = progress toward the next reward. When the balance reaches
 * the threshold a reward unlocks and a `redeemed` entry of −threshold is written (repeatedly, when
 * one order crosses several thresholds); the remainder carries over.
 */

export type RewardType = "choose_from_category" | "specific_products" | "fixed_amount" | "percent";
export type StampKind = "earned" | "manual" | "reversed" | "redeemed" | "expired";
export type RewardStatus = "available" | "redeemed" | "expired" | "revoked";
export type PassportHow = "auto" | "request" | "manual";

export type LoyaltyRule = {
  id: string;
  version: number;
  stampsPerItem: number;
  /** Both empty = every product qualifies; otherwise a line qualifies by category OR product. */
  qualifyingCategoryIds: readonly string[];
  qualifyingProductIds: readonly string[];
  stampsForReward: number;
  rewardType: RewardType;
  rewardLabel: string;
  /** null = passports only on request. */
  issuePassportAfterPurchases: number | null;
  rewardItemsEarnStamps: boolean;
  expiryMonths: number | null;
};

export type OrderLineInput = {
  id: string;
  qty: number;
  categoryId: string | null;
  productId: string | null;
  destinationId: string | null;
  isReward: boolean;
};

export type StampEntry = {
  id: string;
  kind: StampKind;
  stamps: number;
  ruleVersionId: string | null;
  orderId?: string | null;
  orderLineId?: string | null;
  destinationId?: string | null;
  rewardId?: string | null;
  reversesId?: string | null;
};

export type Reward = {
  id: string;
  status: RewardStatus;
  stampsCost: number;
  ruleVersionId: string;
  sourceOrderId: string | null;
  redeemedOrderId: string | null;
};

export type Card = {
  entries: StampEntry[];
  rewards: Reward[];
  passport: PassportHow | null;
  /** Paid, non-cancelled orders with at least one non-reward line. */
  paidPurchases: number;
};

export const emptyCard = (): Card => ({ entries: [], rewards: [], passport: null, paidPurchases: 0 });

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function lineQualifies(rule: LoyaltyRule, line: OrderLineInput): boolean {
  if (line.isReward && !rule.rewardItemsEarnStamps) return false;
  if (!rule.qualifyingCategoryIds.length && !rule.qualifyingProductIds.length) return true;
  return (
    (line.categoryId !== null && rule.qualifyingCategoryIds.includes(line.categoryId)) ||
    (line.productId !== null && rule.qualifyingProductIds.includes(line.productId))
  );
}

/** Stamps a line earns under a rule: qty × stamps per item when it qualifies. */
export function lineStamps(rule: LoyaltyRule, line: OrderLineInput): number {
  return lineQualifies(rule, line) ? line.qty * rule.stampsPerItem : 0;
}

export const balanceOf = (entries: readonly StampEntry[]) =>
  entries.reduce((sum, e) => sum + e.stamps, 0);

/** Net stamps collected over time (exchanges for rewards excluded). */
export const collectedOf = (entries: readonly StampEntry[]) =>
  entries.reduce((sum, e) => (e.kind === "redeemed" ? sum : sum + e.stamps), 0);

/**
 * Withdraw unused rewards while the balance is negative, then unlock one reward per full card
 * while the balance is at or above the active threshold. Mirrors `loyalty_settle`.
 */
export function settle(
  card: Card,
  rule: LoyaltyRule | null,
  enabled: boolean,
  orderId: string | null = null,
): { card: Card; unlocked: Reward[] } {
  const entries = [...card.entries];
  const rewards = card.rewards.map((r) => ({ ...r }));
  let balance = balanceOf(entries);

  while (balance < 0) {
    const latest = [...rewards].reverse().find((r) => r.status === "available");
    if (!latest) break;
    latest.status = "revoked";
    entries.push({
      id: nextId("s"),
      kind: "redeemed",
      stamps: latest.stampsCost,
      ruleVersionId: latest.ruleVersionId,
      orderId,
      rewardId: latest.id,
    });
    balance += latest.stampsCost;
  }

  const unlocked: Reward[] = [];
  if (enabled && rule) {
    while (balance >= rule.stampsForReward) {
      const reward: Reward = {
        id: nextId("r"),
        status: "available",
        stampsCost: rule.stampsForReward,
        ruleVersionId: rule.id,
        sourceOrderId: orderId,
        redeemedOrderId: null,
      };
      rewards.push(reward);
      unlocked.push(reward);
      entries.push({
        id: nextId("s"),
        kind: "redeemed",
        stamps: -rule.stampsForReward,
        ruleVersionId: rule.id,
        orderId,
        rewardId: reward.id,
      });
      balance -= rule.stampsForReward;
    }
  }
  return { card: { ...card, entries, rewards }, unlocked };
}

/**
 * A fully paid order: earn per qualifying line (idempotent per line), auto-issue the passport
 * after N purchases, settle. Mirrors `loyalty_award_order`.
 */
export function awardOrder(
  card: Card,
  rule: LoyaltyRule | null,
  enabled: boolean,
  order: { id: string; lines: readonly OrderLineInput[] },
): { card: Card; awarded: number; unlocked: Reward[]; passportIssued: boolean } {
  if (!enabled || !rule) return { card, awarded: 0, unlocked: [], passportIssued: false };
  const entries = [...card.entries];
  let awarded = 0;
  for (const line of order.lines) {
    const stamps = lineStamps(rule, line);
    if (stamps <= 0) continue;
    if (entries.some((e) => e.kind === "earned" && e.orderLineId === line.id)) continue;
    entries.push({
      id: nextId("s"),
      kind: "earned",
      stamps,
      ruleVersionId: rule.id,
      orderId: order.id,
      orderLineId: line.id,
      destinationId: line.destinationId,
    });
    awarded += stamps;
  }
  const isPurchase = order.lines.some((l) => !l.isReward);
  const paidPurchases = card.paidPurchases + (isPurchase ? 1 : 0);
  const passportIssued =
    card.passport === null && passportDue(rule, paidPurchases, card.passport !== null);
  const next: Card = {
    ...card,
    entries,
    paidPurchases,
    passport: passportIssued ? "auto" : card.passport,
  };
  const settled = settle(next, rule, enabled, order.id);
  return { card: settled.card, awarded, unlocked: settled.unlocked, passportIssued };
}

export function passportDue(rule: LoyaltyRule, paidPurchases: number, hasPassport: boolean) {
  return (
    !hasPassport &&
    rule.issuePassportAfterPurchases !== null &&
    paidPurchases >= rule.issuePassportAfterPurchases
  );
}

/**
 * Cancellation / full refund: reverse each earned entry of the order once; on cancellation a
 * reward redeemed on that order becomes available again. Mirrors `loyalty_reverse_order`.
 */
export function reverseOrder(
  card: Card,
  orderId: string,
  opts: { restoreRewards: boolean; rule: LoyaltyRule | null; enabled: boolean },
): { card: Card; reversed: number } {
  const entries = [...card.entries];
  let reversed = 0;
  for (const e of card.entries) {
    if (e.kind !== "earned" || e.orderId !== orderId) continue;
    if (entries.some((r) => r.reversesId === e.id)) continue;
    entries.push({
      id: nextId("s"),
      kind: "reversed",
      stamps: -e.stamps,
      ruleVersionId: e.ruleVersionId,
      orderId,
      orderLineId: e.orderLineId,
      destinationId: e.destinationId,
      reversesId: e.id,
    });
    reversed += e.stamps;
  }
  const rewards = card.rewards.map((r) =>
    opts.restoreRewards && r.status === "redeemed" && r.redeemedOrderId === orderId
      ? { ...r, status: "available" as const, redeemedOrderId: null }
      : r,
  );
  const settled = settle({ ...card, entries, rewards }, opts.rule, opts.enabled, orderId);
  return { card: settled.card, reversed };
}

/** The most stamps staff may remove: the card plus unused rewards (withdrawn first). */
export function maxRemovable(card: Card): number {
  const unused = card.rewards
    .filter((r) => r.status === "available")
    .reduce((sum, r) => sum + r.stampsCost, 0);
  return Math.max(0, balanceOf(card.entries) + unused);
}

/** Manual ± adjustment (reason checked by the caller). Mirrors `loyalty_adjust_stamps`. */
export function adjust(
  card: Card,
  stamps: number,
  rule: LoyaltyRule | null,
  enabled: boolean,
): { card: Card; unlocked: Reward[] } {
  if (!Number.isInteger(stamps) || stamps === 0 || Math.abs(stamps) > 100) {
    throw new RangeError("stamps must be between -100 and 100 and not 0");
  }
  if (stamps < 0 && -stamps > maxRemovable(card)) {
    throw new RangeError(`only ${maxRemovable(card)} stamps can be removed`);
  }
  const entries: StampEntry[] = [
    ...card.entries,
    { id: nextId("s"), kind: "manual", stamps, ruleVersionId: rule?.id ?? null },
  ];
  return settle({ ...card, entries }, rule, enabled);
}

export type Progress = { collected: number; total: number; remaining: number };

/** Progress on the current card. A negative balance (stamps owed) shows as 0. */
export function progress(balance: number, stampsForReward: number): Progress {
  const total = Math.max(1, stampsForReward);
  const collected = Math.min(Math.max(0, balance), total);
  return { collected, total, remaining: total - collected };
}

/** "8 / 12 — 4 more to your free spray". */
export function progressLabel(p: Progress, rewardLabel: string): string {
  return `${p.collected} / ${p.total} — ${p.remaining} more to ${rewardLabel}`;
}
