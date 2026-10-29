"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  cleanChoices,
  deltaText,
  describeChoices,
  lineKey,
  type LineOptions,
} from "@/modules/catalog/options";
import { MAX_GIVEAWAY_LINE_QTY } from "@/modules/cart/schema";
import { giveawayProblem, giveawayUnitPrice } from "@/modules/giveaways/flow";
import type { StoreGiveaway } from "@/modules/giveaways/types";

/** A giveaway line on a staff order (till or manual): priced again by the database. */
export type StaffGiveawayLine = {
  key: string;
  giveawayId: string;
  variantId: string;
  options: LineOptions;
  qty: number;
  unitFils: number;
  /** "Wedding favours — Capri · 50 ml" */
  title: string;
  /** "Packaging: Gold box · Names: Sara & Omar" */
  detail: string;
};

/**
 * Staff pick a giveaway's bottle, choices and quantity (the same steps as the website, in one
 * dialog). `stockOf` gives the units on hand where the sale happens (shown, not enforced).
 */
export function GiveawayPicker({
  giveaways,
  stockOf,
  open,
  onOpenChange,
  onAdd,
}: {
  giveaways: StoreGiveaway[];
  stockOf?: (variantId: string) => number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: StaffGiveawayLine) => void;
}) {
  const [giveawayId, setGiveawayId] = useState(giveaways[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [choices, setChoices] = useState<LineOptions>([]);
  const [qty, setQty] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const giveaway = giveaways.find((g) => g.id === giveawayId);

  const choice = (groupId: string) => choices.find((c) => c.groupId === groupId);
  const setChoice = (groupId: string, next: Omit<LineOptions[number], "groupId">) => {
    setProblem(null);
    setChoices((prev) => [...prev.filter((c) => c.groupId !== groupId), { groupId, ...next }]);
  };
  const pieces = Number(qty || giveaway?.minOrderQty || 0);
  const unit = giveaway && variantId ? giveawayUnitPrice(giveaway, variantId, choices) : null;

  function reset(nextGiveaway: string) {
    setGiveawayId(nextGiveaway);
    setVariantId("");
    setChoices([]);
    setQty("");
    setProblem(null);
  }

  function add() {
    if (!giveaway) return;
    const missing =
      giveawayProblem(giveaway, variantId || null, choices, pieces) ??
      (pieces > MAX_GIVEAWAY_LINE_QTY ? `At most ${MAX_GIVEAWAY_LINE_QTY} pieces.` : null);
    if (missing) return setProblem(missing);
    const item = giveaway.items.find((i) => i.variantId === variantId)!;
    const options = cleanChoices(giveaway.optionGroups, choices);
    onAdd({
      key: lineKey(variantId, options, giveaway.id),
      giveawayId: giveaway.id,
      variantId,
      options,
      qty: pieces,
      unitFils: unit!,
      title: `${giveaway.name} — ${[item.productName, item.variantLabel].filter(Boolean).join(" · ")}`,
      detail: describeChoices(giveaway.optionGroups, options),
    });
    reset(giveaway.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a giveaway</DialogTitle>
          <DialogDescription>
            Prices come from Products → the giveaway; the system checks them again.
          </DialogDescription>
        </DialogHeader>
        {giveaways.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No giveaways yet — set one up under Products → a product → Giveaway.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <NativeSelect
              aria-label="Giveaway"
              value={giveawayId}
              onChange={(e) => reset(e.target.value)}
              className="[&_select]:h-11"
            >
              {giveaways.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
            {giveaway ? (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Bottle & scent</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {giveaway.items.map((i) => (
                      <label
                        key={i.variantId}
                        className={cn(
                          "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm",
                          variantId === i.variantId && "border-primary bg-primary/5",
                        )}
                      >
                        <input
                          type="radio"
                          name="giveaway-bottle"
                          className="sr-only"
                          checked={variantId === i.variantId}
                          onChange={() => {
                            setVariantId(i.variantId);
                            setProblem(null);
                          }}
                        />
                        <span className="font-medium">
                          {i.productName} {i.variantLabel ? `· ${i.variantLabel}` : ""}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {i.type.name} · {formatAED(i.priceFils)}
                          {stockOf ? ` · ${stockOf(i.variantId)} in stock` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {giveaway.optionGroups.map((g) => (
                  <fieldset key={g.id} className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">
                      {g.name}
                      {g.required ? "" : " (optional)"}
                    </legend>
                    {g.kind === "text" ? (
                      <Input
                        aria-label={g.name}
                        maxLength={g.maxLength}
                        value={choice(g.id)?.text ?? ""}
                        onChange={(e) => setChoice(g.id, { text: e.target.value })}
                        className="h-11"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {g.options.map((o) => {
                          const on = choice(g.id)?.optionIds?.includes(o.id) ?? false;
                          return (
                            <label
                              key={o.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm",
                                on && "border-primary bg-primary/5",
                              )}
                            >
                              <input
                                type={g.kind === "single" ? "radio" : "checkbox"}
                                name={`staff-option-${g.id}`}
                                className="sr-only"
                                checked={on}
                                onChange={() => {
                                  const current = choice(g.id)?.optionIds ?? [];
                                  setChoice(g.id, {
                                    optionIds:
                                      g.kind === "single"
                                        ? [o.id]
                                        : on
                                          ? current.filter((x) => x !== o.id)
                                          : [...current, o.id],
                                  });
                                }}
                              />
                              {o.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- admin preview
                                <img
                                  src={o.imageUrl}
                                  alt=""
                                  className="size-8 rounded-full object-cover"
                                />
                              ) : (
                                <span className="size-2" />
                              )}
                              {o.label}
                              {o.priceDeltaFils ? (
                                <span className="text-muted-foreground numeric">
                                  {deltaText(o.priceDeltaFils)}
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                ))}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Pieces
                    <Input
                      inputMode="numeric"
                      value={qty}
                      placeholder={String(giveaway.minOrderQty)}
                      onChange={(e) => {
                        setProblem(null);
                        setQty(e.target.value.replace(/\D/g, ""));
                      }}
                      className="numeric h-11 w-28"
                    />
                  </label>
                  <p className="numeric text-sm">
                    {unit !== null ? `${formatAED(unit)} × ${pieces} = ` : ""}
                    <span className="font-semibold">{formatAED((unit ?? 0) * pieces)}</span>
                  </p>
                </div>
                {giveaway.minOrderQty > 1 ? (
                  <p className="text-muted-foreground -mt-2 text-xs">
                    Minimum {giveaway.minOrderQty} pieces.
                  </p>
                ) : null}
              </>
            ) : null}
            {problem ? (
              <p role="alert" className="text-destructive text-sm">
                {problem}
              </p>
            ) : null}
          </div>
        )}
        <DialogFooter>
          <Button size="lg" onClick={add} disabled={!giveaway}>
            Add to order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
