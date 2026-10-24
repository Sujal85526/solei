"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "@/components/store/account/use-account";
import { mySavedCartAction, syncCartAction } from "@/modules/carts/actions";
import { cart, useCart } from "@/modules/cart/store";

/** Signed-in customers' bags are mirrored after this pause, so typing a quantity sends once. */
const SYNC_DELAY_MS = 1500;
let restoredOnce = false;

/**
 * Mirrors a signed-in customer's bag to the server (for bag reminders and other devices) and,
 * on a fresh device with an empty bag, brings their saved bag back. Renders nothing.
 */
export function CartSync() {
  const account = useAccount();
  const state = useCart();
  const signedIn = account.status === "signed_in";
  const key = state ? JSON.stringify(state.lines) : null;
  const last = useRef<string | null>(null);

  // Empty bag on this device → take the saved one (once per page load).
  useEffect(() => {
    if (!signedIn || restoredOnce || !state) return;
    restoredOnce = true;
    if (state.lines.length) return;
    mySavedCartAction()
      .then((lines) => {
        for (const l of lines) cart.add(l.variantId, l.qty);
      })
      .catch(() => {});
  }, [signedIn, state]);

  useEffect(() => {
    if (!signedIn || !state || key === last.current) return;
    if (last.current === null && state.lines.length === 0) {
      // Fresh device with an empty bag: don't wipe the saved one (it's being brought back).
      last.current = key;
      return;
    }
    const lines = state.lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
    const id = window.setTimeout(() => {
      last.current = key;
      void syncCartAction(lines);
    }, SYNC_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, key]);

  return null;
}
