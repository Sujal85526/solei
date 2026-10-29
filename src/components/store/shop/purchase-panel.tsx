"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { bestSale, type LiveSale } from "@/modules/promotions/quote";
import { cn } from "@/lib/utils";
import {
  cleanChoices,
  optionsProblem,
  unitPriceWithOptions,
  type LineOptions,
  type OptionGroup,
} from "@/modules/catalog/options";
import { qtyOf } from "@/modules/cart/logic";
import { cartDrawer } from "@/modules/cart/drawer";
import { MAX_LINE_QTY as MAX_QTY } from "@/modules/cart/schema";
import { cart, useCart } from "@/modules/cart/store";
import type { Availability, StoreVariant } from "@/modules/storefront/types";
import { QtyStepper } from "@/components/store/cart/qty-stepper";
import { OptionChoices } from "./option-choices";

/**
 * Size choice (when there is more than one), "Add to cart" (adds and opens the cart
 * drawer) and "Buy now" (adds, then goes
 * straight to checkout). `availability` is null while it streams in (buttons stay disabled); a
 * size can't be added beyond what's in stock minus what's already in the cart.
 */
export function PurchasePanel({
  variants,
  availability,
  optionGroups = [],
  minOrderQty = 1,
  productId,
  sales = [],
}: {
  variants: StoreVariant[];
  availability: Availability | null;
  /** Giveaways: the customer's choices (ribbon, tag text…) with their price changes. */
  optionGroups?: OptionGroup[];
  /** Fewest pieces per order; the quantity starts here. */
  minOrderQty?: number;
  /** Live sales (was/now prices; the bag and checkout price them in the database). */
  productId?: string;
  sales?: LiveSale[];
}) {
  const router = useRouter();
  const state = useCart();
  const [variantId, setVariantId] = useState(variants[0].id);
  const customised = optionGroups.length > 0 || minOrderQty > 1;
  const [choices, setChoices] = useState<LineOptions>([]);
  const [qty, setQty] = useState(minOrderQty);
  const [problem, setProblem] = useState<string | null>(null);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const known = availability !== null;
  const available = availability?.[variant.id] ?? 0;
  const inCart = state ? qtyOf(state, variant.id) : 0;
  const soldOut = known && available === 0;
  const allInCart = known && !soldOut && available - inCart <= 0;
  const room = available - inCart;
  const canAdd = known && state !== null && room >= (customised ? qty : 1);
  const listFils = unitPriceWithOptions(variant.priceFils, optionGroups, choices);
  const salePrice = (fils: number) =>
    productId ? (bestSale(productId, fils, sales, null)?.priceFils ?? fils) : fils;
  const unitFils = salePrice(listFils);

  function add() {
    if (!canAdd) return false;
    if (customised) {
      const missing = optionsProblem(optionGroups, choices);
      setProblem(missing);
      if (missing) return false;
      cart.add(variant.id, qty, cleanChoices(optionGroups, choices));
      return true;
    }
    cart.add(variant.id, 1);
    return true;
  }

  const choice = (groupId: string) => choices.find((c) => c.groupId === groupId);
  const setChoice = (groupId: string, next: Omit<LineOptions[number], "groupId">) => {
    setProblem(null);
    setChoices((prev) => [...prev.filter((c) => c.groupId !== groupId), { groupId, ...next }]);
  };

  function addToCart() {
    if (add()) cartDrawer.open();
  }

  function buyNow() {
    if (add() || allInCart) router.push("/checkout");
  }

  const label = !known
    ? t.product.checking
    : soldOut
      ? t.product.soldOut
      : allInCart
        ? t.product.allInCart
        : t.product.addToCart;

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
                  {v.label || v.sku} ·{" "}
                  <span className="numeric">
                    {salePrice(v.priceFils) < v.priceFils ? (
                      <s className="me-1 opacity-60">{formatAED(v.priceFils)}</s>
                    ) : null}
                    {formatAED(salePrice(v.priceFils))}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {optionGroups.map((g) => (
        <OptionChoices
          key={g.id}
          group={g}
          value={choice(g.id)}
          onChange={(next) => setChoice(g.id, next)}
        />
      ))}

      {customised ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <QtyStepper
            value={qty}
            min={minOrderQty}
            max={Math.max(minOrderQty, Math.min(MAX_QTY, room))}
            onChange={setQty}
            shape="square"
            size="md"
          />
          <p className="numeric text-primary text-sm">
            {formatAED(unitFils)} {t.product.each} ·{" "}
            <span className="font-medium">{formatAED(unitFils * qty)}</span>
          </p>
          {minOrderQty > 1 ? (
            <p className="text-primary/60 w-full text-xs">{t.product.minPieces(minOrderQty)}</p>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
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
