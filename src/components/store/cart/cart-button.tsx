"use client";

import { BagIcon } from "@/components/brand";
import { t } from "@/content/en";
import { cartDrawer } from "@/modules/cart/drawer";
import { CartCount } from "./cart-count";

/** Header bag: opens the cart drawer. */
export function CartButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} title={t.nav.cart} onClick={cartDrawer.open}>
      <span className="relative">
        <BagIcon className="size-[1.3rem]" />
        <CartCount />
      </span>
      <span className="sr-only">{t.nav.cart}</span>
    </button>
  );
}
