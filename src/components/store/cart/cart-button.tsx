"use client";

import Link from "next/link";
import { BagIcon } from "@/components/brand";
import { t } from "@/content/en";
import { cartDrawer } from "@/modules/cart/drawer";
import { CartCount } from "./cart-count";

/** Header bag: opens the cart drawer (falls back to the cart page without JavaScript). */
export function CartButton({ className }: { className?: string }) {
  return (
    <Link
      href="/cart"
      className={className}
      title={t.nav.cart}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        cartDrawer.open();
      }}
    >
      <span className="relative">
        <BagIcon className="size-[1.3rem]" />
        <CartCount />
      </span>
      <span className="sr-only">{t.nav.cart}</span>
    </Link>
  );
}
