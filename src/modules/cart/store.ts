import { useSyncExternalStore } from "react";
import {
  addLine,
  EMPTY_CART,
  itemCount,
  parseCart,
  reconcile,
  removeLine,
  serializeCart,
  setEmirate,
  setQty,
  type CartState,
} from "./logic";
import type { Emirate } from "./schema";

/**
 * Client cart persisted in localStorage and read with `useSyncExternalStore` — no provider, works
 * in any client component, stays in sync across tabs via the `storage` event.
 */

export const CART_STORAGE_KEY = "solei.cart.v1";

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedState: CartState = EMPTY_CART;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // e.g. storage disabled
  }
}

function read(): CartState {
  const raw = storage()?.getItem(CART_STORAGE_KEY) ?? null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseCart(raw);
  }
  return cachedState;
}

function write(next: CartState) {
  if (next === read()) return;
  const raw = serializeCart(next);
  try {
    storage()?.setItem(CART_STORAGE_KEY, raw);
  } catch {
    // Quota exceeded / storage disabled: the change is lost on the next read; nothing to break.
  }
  cachedRaw = raw;
  cachedState = next;
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key === CART_STORAGE_KEY) for (const l of listeners) l();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export const getSnapshot = read;
/** `null` on the server and during hydration: the cart is unknown until the client reads storage. */
export const getServerSnapshot = (): CartState | null => null;

export const cart = {
  get: read,
  add: (variantId: string, qty = 1) => write(addLine(read(), variantId, qty)),
  setQty: (variantId: string, qty: number) => write(setQty(read(), variantId, qty)),
  remove: (variantId: string) => write(removeLine(read(), variantId)),
  setEmirate: (emirate: Emirate | null) => write(setEmirate(read(), emirate)),
  reconcile: (allowed: Map<string, number>) => write(reconcile(read(), allowed)),
  clear: () => write({ ...read(), lines: [] }),
};

/** Current cart, or `null` before hydration (render a placeholder then). */
export function useCart(): CartState | null {
  return useSyncExternalStore<CartState | null>(subscribe, getSnapshot, getServerSnapshot);
}

export function useCartCount(): number | null {
  const state = useCart();
  return state ? itemCount(state) : null;
}
