"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { cart } from "@/modules/cart/store";

/** Clears the cart once the order is paid. */
export function ClearCartOnPaid() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}

/**
 * While the payment is being confirmed, refresh the page a few times. `check` (a Server Action)
 * asks the provider directly first — right away, then before each refresh — for providers whose
 * webhooks may never arrive (N-Genius).
 */
export function AwaitPayment({
  check,
  attempts = 15,
  intervalMs = 2000,
}: {
  check?: () => Promise<void>;
  attempts?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  // Each refresh passes a new bound action; keep the latest without restarting the timer.
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);
  useEffect(() => {
    let n = 0;
    let stopped = false;
    const tick = async () => {
      await checkRef.current?.().catch(() => {});
      if (!stopped) router.refresh();
    };
    void tick();
    const id = setInterval(() => {
      n += 1;
      void tick();
      if (n >= attempts) clearInterval(id);
    }, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [router, attempts, intervalMs]);
  return null;
}
