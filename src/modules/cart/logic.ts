import { lineKey, type LineOptions } from "@/modules/catalog/options";
import {
  cartLineSchema,
  emirateSchema,
  MAX_LINES,
  maxLineQty,
  type CartLine,
  type Emirate,
} from "./schema";

/**
 * Pure cart state transitions. The cart only remembers *what* and *how many*; names, prices and
 * availability always come from the server (`getCartDetails`).
 */

export type CartState = {
  lines: CartLine[];
  /** Emirate chosen for the delivery estimate (a preference, not part of the order). */
  emirate: Emirate | null;
  /**
   * Discount codes applied at checkout, kept with the bag so a reload doesn't drop them. Only
   * remembered here — the server checks them again on every price update and at the order.
   */
  coupons?: string[];
};

/** Most codes one order can carry (they must combine). */
export const MAX_CODES = 5;

export const EMPTY_CART: CartState = Object.freeze({ lines: [], emirate: null }) as CartState;

const clampQty = (qty: number, max: number) => Math.max(0, Math.min(max, Math.trunc(qty)));

/** A line's identity: the variant, plus its options (and giveaway) for customised products. */
export const keyOf = (line: Pick<CartLine, "variantId" | "options" | "giveawayId">) =>
  lineKey(line.variantId, line.options, line.giveawayId);

/**
 * Add `qty` units of a variant (with its chosen options and giveaway, for giveaways), merging with
 * the same line if it's already in the cart.
 */
export function addLine(
  state: CartState,
  variantId: string,
  qty = 1,
  options?: LineOptions,
  giveawayId?: string,
): CartState {
  if (qty <= 0) return state;
  const opts = options?.length ? options : undefined;
  const key = lineKey(variantId, opts, giveawayId);
  const existing = state.lines.find((l) => keyOf(l) === key);
  if (existing) return setQty(state, key, existing.qty + qty);
  if (state.lines.length >= MAX_LINES) return state;
  const next = clampQty(qty, maxLineQty({ giveawayId }));
  if (!next) return state;
  return {
    ...state,
    lines: [
      ...state.lines,
      {
        variantId,
        qty: next,
        ...(opts ? { options: opts } : {}),
        ...(giveawayId ? { giveawayId } : {}),
      },
    ],
  };
}

/** Set a line's quantity (by its key — the variant id for ordinary lines); 0 removes it. */
export function setQty(state: CartState, key: string, qty: number): CartState {
  const line = state.lines.find((l) => keyOf(l) === key);
  const next = clampQty(qty, line ? maxLineQty(line) : 0);
  if (next === 0) return removeLine(state, key);
  if (!line) return state;
  return {
    ...state,
    lines: state.lines.map((l) => (keyOf(l) === key ? { ...l, qty: next } : l)),
  };
}

export function removeLine(state: CartState, key: string): CartState {
  if (!state.lines.some((l) => keyOf(l) === key)) return state;
  return { ...state, lines: state.lines.filter((l) => keyOf(l) !== key) };
}

export function setEmirate(state: CartState, emirate: Emirate | null): CartState {
  return state.emirate === emirate ? state : { ...state, emirate };
}

/**
 * Reconcile the cart with the server's view: `allowed` maps each line key to the quantity it may
 * keep (0 = remove). Lines missing from the map are left untouched.
 */
export function reconcile(state: CartState, allowed: Map<string, number>): CartState {
  let changed = false;
  const lines = state.lines.flatMap((l) => {
    const max = allowed.get(keyOf(l));
    if (max === undefined || l.qty <= max) return [l];
    changed = true;
    return max > 0 ? [{ ...l, qty: max }] : [];
  });
  return changed ? { ...state, lines } : state;
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Units of a variant in the cart, across all its lines. */
export function qtyOf(state: CartState, variantId: string): number {
  return state.lines.filter((l) => l.variantId === variantId).reduce((s, l) => s + l.qty, 0);
}

/**
 * Parse persisted JSON defensively: anything malformed is dropped rather than breaking the page.
 * Duplicate lines are merged.
 */
export function parseCart(raw: string | null): CartState {
  if (!raw) return EMPTY_CART;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_CART;
  }
  if (!data || typeof data !== "object") return EMPTY_CART;
  const obj = data as { lines?: unknown; emirate?: unknown; coupons?: unknown };
  let state: CartState = {
    lines: [],
    emirate: emirateSchema.safeParse(obj.emirate).success ? (obj.emirate as Emirate) : null,
  };
  if (Array.isArray(obj.coupons)) state = setCoupons(state, obj.coupons.filter(isString));
  if (Array.isArray(obj.lines)) {
    for (const item of obj.lines) {
      const line = cartLineSchema.safeParse(item);
      if (line.success)
        state = addLine(
          state,
          line.data.variantId,
          line.data.qty,
          line.data.options,
          line.data.giveawayId,
        );
    }
  }
  return state;
}

export function serializeCart(state: CartState): string {
  return JSON.stringify({
    v: 1,
    lines: state.lines,
    emirate: state.emirate,
    ...(state.coupons?.length ? { coupons: state.coupons } : {}),
  });
}

const isString = (v: unknown): v is string => typeof v === "string";

/** The applied discount codes (normalised, de-duplicated, at most MAX_CODES). */
export function setCoupons(state: CartState, codes: string[]): CartState {
  const next = [
    ...new Set(
      codes
        .map((c) => c.trim().toUpperCase().replace(/\s+/g, ""))
        .filter((c) => c && c.length <= 40),
    ),
  ].slice(0, MAX_CODES);
  const current = state.coupons ?? [];
  if (next.length === current.length && next.every((c, i) => c === current[i])) return state;
  return { ...state, coupons: next };
}
