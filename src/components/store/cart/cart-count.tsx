"use client";

import { t } from "@/content/en";
import { useCartCount } from "@/modules/cart/store";

/** Live item-count badge on the header cart icon (reads the persisted cart). */
export function CartCount() {
  const count = useCartCount();
  if (!count) return null;
  return (
    <>
      <span
        aria-hidden
        data-testid="cart-count"
        className="bg-pink text-burgundy numeric animate-in zoom-in-50 absolute end-0.5 top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold duration-300"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">, {t.cart.items(count)}</span>
    </>
  );
}
