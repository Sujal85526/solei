/** Joins destination names: "Capri", "Capri and Soho", "Capri, Soho and Monaco". */
export function destinationList(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "a new stamp";
  return `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
}

/** Signed stamp count for ledgers: +3 / −2. */
export function signedStamps(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

type RuleLike = {
  stampsPerItem: number;
  qualifyingCategoryIds: readonly string[];
  qualifyingProductIds: readonly string[];
  stampsForReward: number;
  rewardLabel: string;
  issuePassportAfterPurchases: number | null;
  rewardItemsEarnStamps: boolean;
  expiryMonths: number | null;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Plain-language summary of a rule version, one line per setting. */
export function describeRule(
  rule: RuleLike,
  names: (id: string) => string | undefined = () => undefined,
) {
  const scope =
    !rule.qualifyingCategoryIds.length && !rule.qualifyingProductIds.length
      ? "every product"
      : [...rule.qualifyingCategoryIds, ...rule.qualifyingProductIds]
          .map((id) => names(id) ?? "a removed item")
          .join(", ");
  return [
    `${plural(rule.stampsPerItem, "stamp")} per item (${scope})`,
    `${plural(rule.stampsForReward, "stamp")} = ${rule.rewardLabel}`,
    rule.issuePassportAfterPurchases === null
      ? "Passport on request"
      : `Passport after ${plural(rule.issuePassportAfterPurchases, "purchase")} or on request`,
    rule.rewardItemsEarnStamps ? "Reward items earn stamps" : "Reward items don't earn stamps",
    rule.expiryMonths === null
      ? "Stamps never expire"
      : `Stamps expire after ${plural(rule.expiryMonths, "month")}`,
  ];
}

type StickerSource = {
  kind: "earned" | "manual" | "reversed" | "redeemed" | "expired";
  stamps: number;
  destination: string | null;
  createdAt: string;
  order?: { id: string } | null;
};

/**
 * Destination stickers on the current card: the most recent `balance` stamp units from earned and
 * manual entries (oldest first), skipping order stamps that were reversed. Exchanged stamps are
 * the oldest ones, so what remains on the card is the latest collection.
 */
export function currentCardStickers(
  entries: readonly StickerSource[],
  balance: number,
): (string | null)[] {
  const key = (e: StickerSource) => `${e.order?.id}:${e.destination ?? ""}`;
  const reversed = new Set(entries.filter((e) => e.kind === "reversed" && e.order).map(key));
  const units = [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter(
      (e) =>
        (e.kind === "earned" || e.kind === "manual") &&
        e.stamps > 0 &&
        !(e.kind === "earned" && e.order && reversed.has(key(e))),
    )
    .flatMap((e) => Array.from({ length: e.stamps }, () => e.destination));
  const keep = Math.max(0, Math.min(balance, units.length));
  return keep ? units.slice(units.length - keep) : [];
}

/** Destinations collected over time with how many stamps each (most first). */
export function destinationTally(entries: readonly StickerSource[]) {
  const tally = new Map<string, number>();
  for (const e of entries) {
    if (!e.destination || (e.kind !== "earned" && e.kind !== "reversed")) continue;
    tally.set(e.destination, (tally.get(e.destination) ?? 0) + e.stamps);
  }
  return [...tally.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}
