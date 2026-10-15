import { useSyncExternalStore } from "react";

/**
 * Open/closed state of the cart drawer, shared by the header bag, "Add to cart" and the drawer
 * itself without a provider.
 */
let open = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === open) return;
  open = next;
  for (const l of listeners) l();
}

export const cartDrawer = {
  open: () => set(true),
  close: () => set(false),
  set,
};

export function useCartDrawerOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
