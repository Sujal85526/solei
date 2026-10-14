"use client";

import { t } from "@/content/en";
import { useCartCount } from "@/modules/cart/store";

/** Live item count as a small badge on the header bag icon (hidden while the cart is empty). */
export function CartCount() {
  const count = useCartCount() ?? 0;
  return (
    <>
      <span
        aria-hidden
        data-testid="cart-count"
        className={`numeric bg-pink text-burgundy absolute -end-2 -top-1.5 min-w-4 rounded-full px-1 text-center text-[0.6rem] leading-4 font-medium ${count ? "" : "hidden"}`}
      >
        {count > 99 ? "99+" : count}
      </span>
      {count ? <span className="sr-only">, {t.cart.items(count)}</span> : null}
    </>
  );
}
