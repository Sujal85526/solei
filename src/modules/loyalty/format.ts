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
