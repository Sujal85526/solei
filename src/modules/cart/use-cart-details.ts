"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getCartDetails } from "./actions";
import type { CartDetailLine, CartDetails } from "./details";
import { cart, useCart } from "./store";

/**
 * The browser cart joined with server truth: names, images, prices, availability and totals from
 * `getCartDetails`, refreshed whenever the lines or emirate change. Lines the server can't fulfil
 * are clamped/dropped and reported as `notices`. Shared by the cart page and the cart drawer.
 * Pass `enabled: false` to skip fetching (e.g. while the drawer is closed).
 */
export function useCartDetails({
  enabled = true,
  describe,
}: {
  enabled?: boolean;
  /** Turns lines the server changed into user-facing notices. */
  describe: (lines: CartDetailLine[]) => string[];
}) {
  const state = useCart();
  const [details, setDetails] = useState<CartDetails | null>(null);
  const [error, setError] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);

  const key = state ? JSON.stringify([state.lines, state.emirate]) : null;

  useEffect(() => {
    if (!enabled || !key || !state || !state.lines.length) return;
    const id = ++request.current;
    const input = { lines: state.lines, emirate: state.emirate };
    startTransition(async () => {
      try {
        const res = await getCartDetails(input);
        if (id !== request.current) return;
        startTransition(() => {
          setError(false);
          setDetails(res);
          const fresh = describe(res.lines);
          if (fresh.length) setNotices((prev) => [...new Set([...prev, ...fresh])]);
        });
        // Clamp / drop lines the server can't fulfil; this re-runs the effect once.
        const allowed = new Map(
          res.lines.filter((l) => l.status !== "ok").map((l) => [l.variantId, l.qty]),
        );
        if (allowed.size) cart.reconcile(allowed);
      } catch {
        if (id === request.current) startTransition(() => setError(true));
      }
    });
    // `state` is derived from `key`; re-run only when the cart content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, enabled]);

  const byVariant = useMemo(
    () => new Map(details?.lines.map((l) => [l.variantId, l]) ?? []),
    [details],
  );

  return {
    state,
    details,
    byVariant,
    error,
    notices,
    /** True while totals are being (re)computed. */
    stale: pending || !details,
    retry: () => setAttempt((a) => a + 1),
    dismiss: (notice: string) => setNotices((prev) => prev.filter((n) => n !== notice)),
  };
}
