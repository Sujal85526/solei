"use client";

import { t } from "@/content/en";
import { useCartCount } from "@/modules/cart/store";

/** Live item count after the header "Cart" link, e.g. "Cart (2)". */
export function CartCount() {
  const count = useCartCount() ?? 0;
  return (
    <>
      <span aria-hidden data-testid="cart-count" className="numeric">
        ({count > 99 ? "99+" : count})
      </span>
      {count ? <span className="sr-only">, {t.cart.items(count)}</span> : null}
    </>
  );
}
