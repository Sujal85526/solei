/** Joins destination names: "Capri", "Capri and Soho", "Capri, Soho and Monaco". */
export function destinationList(names: string[]): string {
  const unique = [...new Set(names.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "a new stamp";
  return `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
}

/** Signed stamp count for ledgers: +3 / −2. */
export function signedStamps(n: number): string {
  return n > 0 ? `+${n}` : `\u2212${Math.abs(n)}`;
}
