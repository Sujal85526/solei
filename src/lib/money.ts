/**
 * Money is stored and computed as integer fils (1 AED = 100 fils).
 * Never use floats for amounts; convert only at the edges (input parsing, display).
 */

export type Fils = number;

/** VAT and other rates are stored as basis points: 500 = 5%. */
export type BasisPoints = number;

export const FILS_PER_AED = 100;

export function aedToFils(aed: number | string): Fils {
  const value = typeof aed === "string" ? Number(aed.replace(/[,\s]/g, "")) : aed;
  if (!Number.isFinite(value)) throw new Error(`Invalid AED amount: ${aed}`);
  return Math.round(value * FILS_PER_AED);
}

export function filsToAed(fils: Fils): number {
  return fils / FILS_PER_AED;
}

export function assertFils(value: number): asserts value is Fils {
  if (!Number.isSafeInteger(value)) throw new Error(`Amount must be integer fils, got ${value}`);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(showFils: boolean) {
  const key = String(showFils);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-AE", {
      minimumFractionDigits: showFils ? 2 : 0,
      maximumFractionDigits: 2,
    });
    formatters.set(key, f);
  }
  return f;
}

/** "AED 280" / "AED 12.50". Whole amounts drop the decimals unless `alwaysShowFils`. */
export function formatAED(fils: Fils, opts: { alwaysShowFils?: boolean } = {}): string {
  const showFils = opts.alwaysShowFils || fils % FILS_PER_AED !== 0;
  const sign = fils < 0 ? "-" : "";
  return `${sign}AED ${formatter(showFils).format(Math.abs(fils) / FILS_PER_AED)}`;
}

/** Banker-neutral half-up rounding of a/b for non-negative integers. */
function divRound(a: number, b: number): number {
  return Math.floor((a * 2 + b) / (b * 2));
}

/** VAT contained in a VAT-inclusive amount: total × rate / (1 + rate). */
export function vatFromInclusive(totalFils: Fils, rateBp: BasisPoints): Fils {
  assertFils(totalFils);
  if (rateBp <= 0) return 0;
  const sign = Math.sign(totalFils);
  return sign * divRound(Math.abs(totalFils) * rateBp, 10_000 + rateBp);
}

/** VAT to add on top of a VAT-exclusive amount: net × rate. */
export function vatOnExclusive(netFils: Fils, rateBp: BasisPoints): Fils {
  assertFils(netFils);
  if (rateBp <= 0) return 0;
  const sign = Math.sign(netFils);
  return sign * divRound(Math.abs(netFils) * rateBp, 10_000);
}

/** Split an amount into n integer parts that sum exactly to the amount (for split payments, pro-rating). */
export function allocate(totalFils: Fils, parts: number): Fils[] {
  assertFils(totalFils);
  if (parts < 1) throw new Error("parts must be >= 1");
  const base = Math.trunc(totalFils / parts);
  let remainder = totalFils - base * parts;
  return Array.from({ length: parts }, () => {
    if (remainder === 0) return base;
    const step = Math.sign(remainder);
    remainder -= step;
    return base + step;
  });
}
