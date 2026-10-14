import {
  cartLineSchema,
  emirateSchema,
  MAX_LINE_QTY,
  MAX_LINES,
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
};

export const EMPTY_CART: CartState = Object.freeze({ lines: [], emirate: null }) as CartState;

const clampQty = (qty: number) => Math.max(0, Math.min(MAX_LINE_QTY, Math.trunc(qty)));

/** Add `qty` units of a variant, merging with an existing line. */
export function addLine(state: CartState, variantId: string, qty = 1): CartState {
  if (qty <= 0) return state;
  const existing = state.lines.find((l) => l.variantId === variantId);
  if (existing) return setQty(state, variantId, existing.qty + qty);
  if (state.lines.length >= MAX_LINES) return state;
  const next = clampQty(qty);
  return next ? { ...state, lines: [...state.lines, { variantId, qty: next }] } : state;
}

/** Set a line's quantity; 0 (or less) removes it. */
export function setQty(state: CartState, variantId: string, qty: number): CartState {
  const next = clampQty(qty);
  if (next === 0) return removeLine(state, variantId);
  if (!state.lines.some((l) => l.variantId === variantId)) return state;
  return {
    ...state,
    lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, qty: next } : l)),
  };
}

export function removeLine(state: CartState, variantId: string): CartState {
  if (!state.lines.some((l) => l.variantId === variantId)) return state;
  return { ...state, lines: state.lines.filter((l) => l.variantId !== variantId) };
}

export function setEmirate(state: CartState, emirate: Emirate | null): CartState {
  return state.emirate === emirate ? state : { ...state, emirate };
}

/**
 * Reconcile the cart with the server's view: `allowed` maps each variant to the quantity it may
 * keep (0 = remove). Variants missing from the map are left untouched.
 */
export function reconcile(state: CartState, allowed: Map<string, number>): CartState {
  let changed = false;
  const lines = state.lines.flatMap((l) => {
    const max = allowed.get(l.variantId);
    if (max === undefined || l.qty <= max) return [l];
    changed = true;
    return max > 0 ? [{ ...l, qty: max }] : [];
  });
  return changed ? { ...state, lines } : state;
}

export function itemCount(state: CartState): number {
  return state.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function qtyOf(state: CartState, variantId: string): number {
  return state.lines.find((l) => l.variantId === variantId)?.qty ?? 0;
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
  const obj = data as { lines?: unknown; emirate?: unknown };
  let state: CartState = {
    lines: [],
    emirate: emirateSchema.safeParse(obj.emirate).success ? (obj.emirate as Emirate) : null,
  };
  if (Array.isArray(obj.lines)) {
    for (const item of obj.lines) {
      const line = cartLineSchema.safeParse(item);
      if (line.success) state = addLine(state, line.data.variantId, line.data.qty);
    }
  }
  return state;
}

export function serializeCart(state: CartState): string {
  return JSON.stringify({ v: 1, lines: state.lines, emirate: state.emirate });
}
