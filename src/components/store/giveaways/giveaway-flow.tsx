"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OptionChoices } from "@/components/store/shop/option-choices";
import { Button } from "@/components/ui/button";
import { giveawaysCopy as c } from "@/content/giveaways";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { cleanChoices, type LineOptions } from "@/modules/catalog/options";
import { qtyOf } from "@/modules/cart/logic";
import { cartDrawer } from "@/modules/cart/drawer";
import { MAX_GIVEAWAY_LINE_QTY } from "@/modules/cart/schema";
import { cart, useCart } from "@/modules/cart/store";
import {
  choiceGroups,
  giveawayProblem,
  giveawayTypes,
  giveawayUnitPrice,
  itemsOfType,
  textGroups,
} from "@/modules/giveaways/flow";
import type { StoreGiveaway } from "@/modules/giveaways/types";
import type { Availability } from "@/modules/storefront/types";

/**
 * The guided giveaway order, one numbered step under the other: product type (only when the
 * giveaway offers more than one), scent (real bottles, so stock counts), each packaging/design
 * choice (photo tiles), quantity (from the minimum), personalisation — with the live total. The
 * bag and checkout re-price everything on the server.
 */
export function GiveawayFlow({
  giveaway,
  availability,
}: {
  giveaway: StoreGiveaway;
  availability: Availability | null;
}) {
  const router = useRouter();
  const state = useCart();
  const types = giveawayTypes(giveaway.items);
  const [typeSlug, setTypeSlug] = useState<string | null>(
    types.length === 1 ? types[0].slug : null,
  );
  const [variantId, setVariantId] = useState<string | null>(null);
  const [choices, setChoices] = useState<LineOptions>([]);
  const [qty, setQty] = useState(giveaway.minOrderQty);
  const [problem, setProblem] = useState<string | null>(null);

  const known = availability !== null;
  const stockOf = (id: string) =>
    Math.max(0, (availability?.[id] ?? 0) - (state ? qtyOf(state, id) : 0));
  const scents = itemsOfType(giveaway.items, typeSlug);
  const room = variantId ? stockOf(variantId) : 0;
  const unitFils = variantId ? giveawayUnitPrice(giveaway, variantId, choices) : null;

  const choice = (groupId: string) => choices.find((x) => x.groupId === groupId);
  const setChoice = (groupId: string, next: Omit<LineOptions[number], "groupId">) => {
    setProblem(null);
    setChoices((prev) => [...prev.filter((x) => x.groupId !== groupId), { groupId, ...next }]);
  };

  let step = 0;
  const legend = (title: string) => c.stepLabel(++step, title);

  function add() {
    const missing = giveawayProblem(giveaway, variantId, choices, qty);
    if (missing) {
      setProblem(missing);
      return false;
    }
    if (!known || qty > room) {
      setProblem(c.notEnough(room));
      return false;
    }
    cart.add(variantId!, qty, cleanChoices(giveaway.optionGroups, choices), giveaway.id);
    return true;
  }

  return (
    <div className="flex flex-col gap-6" data-testid="giveaway-flow">
      {types.length > 1 ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="eyebrow text-primary/60 mb-2.5 text-[0.6rem]">
            {legend(c.steps.type)}
          </legend>
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <label
                key={type.slug}
                className={cn(
                  "has-[:focus-visible]:ring-primary/30 inline-flex min-h-11 cursor-pointer items-center border px-4 py-2.5 text-xs tracking-[0.12em] uppercase transition-colors has-[:focus-visible]:ring-2",
                  typeSlug === type.slug
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/25 text-primary hover:border-primary",
                )}
              >
                <input
                  type="radio"
                  name="giveaway-type"
                  checked={typeSlug === type.slug}
                  onChange={() => {
                    setTypeSlug(type.slug);
                    setProblem(null);
                    if (
                      !itemsOfType(giveaway.items, type.slug).some((i) => i.variantId === variantId)
                    )
                      setVariantId(null);
                  }}
                  className="sr-only"
                />
                {type.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {typeSlug || types.length <= 1 ? (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="eyebrow text-primary/60 mb-2.5 text-[0.6rem]">
            {legend(c.steps.scent)}
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {scents.map((item) => {
              const left = stockOf(item.variantId);
              const out = known && left === 0;
              const on = variantId === item.variantId;
              return (
                <label
                  key={item.variantId}
                  className={cn(
                    "has-[:focus-visible]:ring-primary/30 flex cursor-pointer flex-col border bg-white/60 transition-colors has-[:focus-visible]:ring-2",
                    on
                      ? "border-primary ring-primary ring-1"
                      : "border-primary/20 hover:border-primary",
                    out && "pointer-events-none opacity-45",
                  )}
                  data-testid="giveaway-scent"
                >
                  <input
                    type="radio"
                    name="giveaway-scent"
                    checked={on}
                    disabled={out}
                    onChange={() => {
                      setVariantId(item.variantId);
                      setProblem(null);
                    }}
                    className="sr-only"
                  />
                  <span className="bg-primary/5 relative block aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element -- catalog storage URLs */}
                    <img
                      src={item.image.url}
                      alt={item.image.alt}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  <span className="text-primary flex flex-col gap-0.5 px-2.5 py-2 text-xs leading-snug">
                    <span className="font-medium">{item.productName}</span>
                    <span className="opacity-70">
                      {[item.variantLabel, formatAED(item.priceFils)].filter(Boolean).join(" · ")}
                    </span>
                    {out ? <span className="opacity-70">{c.soldOut}</span> : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {variantId ? (
        <>
          {choiceGroups(giveaway.optionGroups).map((g) => (
            <OptionChoices
              key={g.id}
              group={g}
              value={choice(g.id)}
              onChange={(next) => setChoice(g.id, next)}
              legend={legend(g.name)}
            />
          ))}

          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow text-primary/60 mb-2.5 text-[0.6rem]">
              {legend(c.steps.quantity)}
            </legend>
            <input
              type="number"
              inputMode="numeric"
              min={giveaway.minOrderQty}
              max={MAX_GIVEAWAY_LINE_QTY}
              value={Number.isFinite(qty) ? qty : ""}
              onChange={(e) => {
                setProblem(null);
                setQty(Math.min(MAX_GIVEAWAY_LINE_QTY, Math.trunc(Number(e.target.value))));
              }}
              aria-label={c.steps.quantity}
              className="border-primary/25 focus:border-primary numeric h-11 w-32 border bg-white/70 px-3 text-sm outline-none"
              data-testid="giveaway-qty"
            />
            <p className="text-primary/60 text-xs">
              {c.quantityHint(giveaway.minOrderQty, known ? room : -1)}
            </p>
          </fieldset>

          {textGroups(giveaway.optionGroups).length ? (
            <div className="flex flex-col gap-1">
              <p className="eyebrow text-primary/60 text-[0.6rem]">{legend(c.steps.personalise)}</p>
              {textGroups(giveaway.optionGroups).map((g) => (
                <OptionChoices
                  key={g.id}
                  group={g}
                  value={choice(g.id)}
                  onChange={(next) => setChoice(g.id, next)}
                />
              ))}
            </div>
          ) : null}

          <div className="border-primary/20 flex flex-col gap-1 border-t pt-5">
            <p className="numeric text-primary flex items-baseline justify-between text-sm">
              <span>
                {unitFils !== null ? formatAED(unitFils) : "—"} {c.each} × {qty || 0}
              </span>
              <span className="text-lg font-medium" data-testid="giveaway-total">
                {c.total} {formatAED((unitFils ?? 0) * (qty || 0))}
              </span>
            </p>
            <p className="text-primary/55 text-[0.7rem]">{c.includesChoices}</p>
          </div>
        </>
      ) : null}

      {problem ? (
        <p role="alert" className="text-destructive text-xs">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          size="cta"
          onClick={() => add() && cartDrawer.open()}
          disabled={!known || !variantId || state === null}
          className="h-12 w-full rounded-none"
          data-testid="giveaway-add"
        >
          {known ? c.addToBag : c.checking}
        </Button>
        <Button
          size="cta"
          variant="outline"
          onClick={() => add() && router.push("/checkout")}
          disabled={!known || !variantId || state === null}
          className="h-12 w-full rounded-none"
        >
          {c.buyNow}
        </Button>
      </div>
    </div>
  );
}
