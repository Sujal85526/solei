"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { AddedSheet, type AddedItem } from "@/components/store/cart/added-sheet";
import { QtyStepper } from "@/components/store/cart/qty-stepper";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { qtyOf } from "@/modules/cart/logic";
import { cart, useCart } from "@/modules/cart/store";
import type { Availability, StoreImage, StoreVariant } from "@/modules/storefront/types";

/**
 * Variant + quantity selection and a stock-aware "Add to cart". `availability` is null while it
 * streams in (button stays disabled). Quantity is capped at what's available minus what's
 * already in the cart.
 */
export function PurchasePanel({
  product,
  variants,
  availability,
  vatNote,
}: {
  product: { name: string; destinationName: string | null; image: StoreImage };
  variants: StoreVariant[];
  availability: Availability | null;
  vatNote: string;
}) {
  const state = useCart();
  const [variantId, setVariantId] = useState(variants[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<AddedItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const known = availability !== null;
  const available = availability?.[variant.id] ?? 0;
  const inCart = state ? qtyOf(state, variant.id) : 0;
  const maxAddable = Math.max(0, available - inCart);
  const soldOut = known && available === 0;
  const allInCart = known && !soldOut && maxAddable === 0;
  const effectiveQty = Math.min(qty, Math.max(1, maxAddable));
  const canAdd = known && state !== null && maxAddable > 0;

  function add() {
    if (!canAdd) return;
    cart.add(variant.id, effectiveQty);
    setAdded({
      name: product.name,
      variantLabel: variant.label,
      destinationName: product.destinationName,
      image: product.image,
      qty: effectiveQty,
      unitPriceFils: variant.priceFils,
    });
    setSheetOpen(true);
    setQty(1);
  }

  const label = !known
    ? t.product.checking
    : soldOut
      ? t.product.soldOut
      : allInCart
        ? t.product.allInCart
        : t.product.addToCart;

  return (
    <div className="flex flex-col gap-6" data-testid="purchase-panel">
      <div className="flex flex-col gap-1">
        <p className="numeric font-display text-pink text-3xl" data-testid="product-price">
          {formatAED(variant.priceFils)}
        </p>
        <p className="text-pearl-muted text-xs tracking-[0.12em]">{vatNote}</p>
      </div>

      {variants.length > 1 ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="eyebrow text-pink/70 mb-3 text-[0.65rem]">{t.product.size}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const out = known && (availability?.[v.id] ?? 0) === 0;
              return (
                <label
                  key={v.id}
                  className={cn(
                    "has-[:focus-visible]:ring-pink/30 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full border px-5 text-sm transition-colors has-[:focus-visible]:ring-3",
                    v.id === variant.id
                      ? "border-pink bg-pink text-pink"
                      : "border-pink/25 text-pink hover:border-pink/60",
                    out && "line-through decoration-1 opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={v.id === variant.id}
                    onChange={() => {
                      setVariantId(v.id);
                      setQty(1);
                    }}
                    className="sr-only"
                  />
                  {v.label || v.sku}
                  <span className="numeric opacity-80">{formatAED(v.priceFils)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : variant.label ? (
        <p className="text-pearl-muted text-sm">
          <span className="eyebrow text-pink/70 me-3 text-[0.65rem]">{t.product.size}</span>
          {variant.label}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <QtyStepper
          value={effectiveQty}
          onChange={setQty}
          max={Math.max(1, maxAddable)}
          disabled={!canAdd}
          className="self-start"
        />
        <Button
          size="cta"
          onClick={add}
          disabled={!canAdd}
          className="h-12 flex-1"
          data-testid="add-to-cart"
        >
          {canAdd ? <ShoppingBag className="size-4" strokeWidth={1.5} /> : null}
          {label}
        </Button>
      </div>
      <AddedSheet item={added} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
