"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cart } from "@/modules/cart/store";

/** Clears the cart once the order is paid. */
export function ClearCartOnPaid() {
  useEffect(() => {
    cart.clear();
  }, []);
  return null;
}

/** While the webhook is on its way, refresh the page a few times. */
export function AwaitPayment({
  attempts = 15,
  intervalMs = 2000,
}: {
  attempts?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= attempts) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, attempts, intervalMs]);
  return null;
}
