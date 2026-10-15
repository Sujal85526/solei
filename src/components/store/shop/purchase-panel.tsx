"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { qtyOf } from "@/modules/cart/logic";
import { cartDrawer } from "@/modules/cart/drawer";
import { cart, useCart } from "@/modules/cart/store";
import type { Availability, StoreVariant } from "@/modules/storefront/types";

/**
 * Size choice (when there is more than one), "Add to cart — AED x" (adds and opens the cart
 * drawer) and "Buy now" (adds, then goes
 * straight to checkout). `availability` is null while it streams in (buttons stay disabled); a
 * size can't be added beyond what's in stock minus what's already in the cart.
 */
export function PurchasePanel({
  variants,
  availability,
}: {
  variants: StoreVariant[];
  availability: Availability | null;
}) {
  const router = useRouter();
  const state = useCart();
  const [variantId, setVariantId] = useState(variants[0].id);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const known = availability !== null;
  const available = availability?.[variant.id] ?? 0;
  const inCart = state ? qtyOf(state, variant.id) : 0;
  const soldOut = known && available === 0;
  const allInCart = known && !soldOut && available - inCart <= 0;
  const canAdd = known && state !== null && available - inCart > 0;

  function add() {
    if (!canAdd) return false;
    cart.add(variant.id, 1);
    return true;
  }

  function addToCart() {
    if (add()) cartDrawer.open();
  }

  function buyNow() {
    if (add() || allInCart) router.push("/checkout");
  }

  const price = formatAED(variant.priceFils);
  const label = !known
    ? t.product.checking
    : soldOut
      ? t.product.soldOut
      : allInCart
        ? t.product.allInCart
        : `${t.product.addToCart} — ${price}`;

  return (
    <div className="flex flex-col gap-3" data-testid="purchase-panel">
      {variants.length > 1 ? (
        <fieldset className="mb-4 flex flex-col gap-3">
          <legend className="eyebrow text-primary/60 mb-3 text-[0.6rem]">{t.product.size}</legend>
          <div className="flex flex-wrap gap-x-7 gap-y-2">
            {variants.map((v) => {
              const out = known && (availability?.[v.id] ?? 0) === 0;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "has-[:focus-visible]:ring-primary/30 cursor-pointer border-b pb-1 text-[0.7rem] tracking-[0.22em] uppercase transition-colors has-[:focus-visible]:ring-2",
                    v.id === variant.id
                      ? "border-primary text-primary"
                      : "text-primary/55 hover:text-primary border-transparent",
                    out && "line-through decoration-1",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={v.id === variant.id}
                    onChange={() => setVariantId(v.id)}
                    className="sr-only"
                  />
                  {v.label || v.sku} · <span className="numeric">{formatAED(v.priceFils)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Button
        size="cta"
        onClick={addToCart}
        disabled={!canAdd}
        className="h-12 w-full rounded-none"
        data-testid="add-to-cart"
      >
        {label}
      </Button>
      <Button
        size="cta"
        variant="outline"
        onClick={buyNow}
        disabled={!canAdd && !allInCart}
        className="h-12 w-full rounded-none"
        data-testid="buy-now"
      >
        {t.product.buyNow}
      </Button>
    </div>
  );
}
