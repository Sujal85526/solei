"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { filsToAed } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveOfferAction } from "@/modules/promotions/actions";
import {
  CHANNEL_LABELS,
  type BundleSlot,
  type Channel,
  type Offer,
  type OfferKind,
} from "@/modules/promotions/schema";
import { ScopeList, type ScopeOption } from "./scope-list";

type ValueType = "percent" | "amount" | "price";
type SlotRow = BundleSlot & { key: string };

const KINDS: { kind: OfferKind; label: string; hint: string }[] = [
  { kind: "sale", label: "Sale price", hint: "Money off each item, e.g. 15% off all sprays" },
  {
    kind: "bundle",
    label: "Bundle",
    hint: "A set for one price, e.g. perfume + spray for AED 450",
  },
  { kind: "buy_x_get_y", label: "Buy X get Y", hint: "e.g. buy 2, get 1 free" },
];

const DEFAULT_VALUE_TYPE: Record<OfferKind, ValueType> = {
  sale: "percent",
  bundle: "price",
  buy_x_get_y: "percent",
};

const newSlot = (key: string): SlotRow => ({
  key,
  label: "",
  productIds: [],
  categoryIds: [],
  qty: 1,
});

/** The value the form shows for a saved offer (a percentage or AED, by its value type). */
function initialValue(offer: Offer): { valueType: ValueType; value: string } {
  if (offer.kind === "sale" && offer.amountFils !== null)
    return { valueType: "amount", value: String(filsToAed(offer.amountFils)) };
  if (offer.kind === "bundle" && offer.bundlePriceFils !== null)
    return { valueType: "price", value: String(filsToAed(offer.bundlePriceFils)) };
  return { valueType: "percent", value: String((offer.percentBp ?? 0) / 100) };
}

/**
 * Create or edit an automatic offer. Staff pick the kind first; only that kind's fields show.
 * Bundle items are edited here and sent as JSON in the hidden `slots` input.
 */
export function OfferForm({
  offer,
  products,
  categories,
}: {
  offer?: Offer;
  products: ScopeOption[];
  categories: ScopeOption[];
}) {
  const [state, action, pending] = useFormAction(saveOfferAction, null);
  const e = useActionToast(state);
  const initial = offer ? initialValue(offer) : { valueType: "percent" as const, value: "" };
  const [kind, setKind] = useState<OfferKind>(offer?.kind ?? "sale");
  const [valueType, setValueType] = useState<ValueType>(initial.valueType);
  const [value, setValue] = useState(initial.value);
  // Stable keys (they also make the inputs' ids, so they must match between server and browser).
  const [slots, setSlots] = useState<SlotRow[]>(() =>
    offer?.slots.length
      ? offer.slots.map((s, i) => ({ ...s, key: `s${i}` }))
      : [newSlot("s0"), newSlot("s1")],
  );
  const nextSlot = useRef(Math.max(offer?.slots.length ?? 0, 2));
  const [limitProducts, setLimitProducts] = useState(
    (offer?.productIds.length ?? 0) + (offer?.categoryIds.length ?? 0) > 0,
  );
  const [limitDates, setLimitDates] = useState(Boolean(offer?.startsOn || offer?.endsOn));
  const channels: Channel[] = offer?.channels ?? ["website", "pos"];

  function pickKind(k: OfferKind) {
    if (k === kind) return;
    setKind(k);
    setValueType(DEFAULT_VALUE_TYPE[k]);
    setValue(k === "buy_x_get_y" ? "100" : "");
  }

  const updateSlot = (key: string, patch: Partial<BundleSlot>) =>
    setSlots((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const valueOptions: [ValueType, string][] =
    kind === "sale"
      ? [
          ["percent", "% off each item"],
          ["amount", "AED off each item"],
        ]
      : [
          ["price", "Price for the whole set (AED)"],
          ["percent", "% off the set"],
        ];

  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      {offer ? <input type="hidden" name="id" value={offer.id} /> : null}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="valueType" value={valueType} />
      {kind === "bundle" ? (
        <input
          type="hidden"
          name="slots"
          value={JSON.stringify(slots.map(({ key: _key, ...s }) => s))}
        />
      ) : null}

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">Offer</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            Kind of offer <span className="text-destructive">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label
                key={k.kind}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm",
                  kind === k.kind ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  checked={kind === k.kind}
                  onChange={() => pickKind(k.kind)}
                  className="accent-primary mt-0.5"
                />
                <span>
                  <span className="font-medium">{k.label}</span>
                  <span className="text-muted-foreground block text-xs">{k.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label="Name"
          htmlFor="name"
          error={e.name}
          hint="Customers see this in the bag, e.g. “Ramadan: 15% off sprays”"
          required
        >
          <Input id="name" name="name" defaultValue={offer?.name} className="h-11" />
        </Field>
      </section>

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">What it gives</h2>

        {kind === "buy_x_get_y" ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Buy"
              htmlFor="buyQty"
              error={e.buyQty}
              hint="Items the customer pays for"
              required
            >
              <Input
                id="buyQty"
                name="buyQty"
                inputMode="numeric"
                defaultValue={offer?.buyQty ?? 2}
                className="h-11"
              />
            </Field>
            <Field
              label="Get"
              htmlFor="getQty"
              error={e.getQty}
              hint="Items that get the discount"
              required
            >
              <Input
                id="getQty"
                name="getQty"
                inputMode="numeric"
                defaultValue={offer?.getQty ?? 1}
                className="h-11"
              />
            </Field>
            <Field
              label="Off the “get” items"
              htmlFor="value"
              error={e.value}
              hint="100 = free; the cheapest items are the ones discounted"
            >
              <ValueInput value={value} onChange={setValue} unit="%" />
            </Field>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {valueOptions.map(([t, label]) => (
                <label
                  key={t}
                  className={cn(
                    "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm",
                    valueType === t ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    checked={valueType === t}
                    onChange={() => setValueType(t)}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
            <Field
              label={valueType === "percent" ? "Percentage" : "Amount in AED"}
              htmlFor="value"
              error={e.value}
              hint={
                valueType === "percent"
                  ? kind === "sale"
                    ? "e.g. 15 for 15% off each item"
                    : "e.g. 20 for 20% off the items of the set"
                  : valueType === "amount"
                    ? "e.g. 30 for AED 30 off each item — never below zero"
                    : "e.g. 450 — what the customer pays for the whole set"
              }
              className="max-w-48"
              required
            >
              <ValueInput
                value={value}
                onChange={setValue}
                unit={valueType === "percent" ? "%" : "AED"}
              />
            </Field>
          </>
        )}

        {kind === "bundle" ? (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Items of the bundle</h3>
              <p className="text-muted-foreground text-xs">
                2 to 6 items. For each, choose the categories or products it can be filled from.
              </p>
            </div>
            {e.slots ? <p className="text-destructive text-sm">{e.slots}</p> : null}
            <ol className="flex flex-col gap-3">
              {slots.map((s, i) => (
                <li key={s.key} className="flex flex-col gap-4 rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground numeric mt-9 text-sm">{i + 1}.</span>
                    <div className="grid flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <Field
                        label="Label"
                        htmlFor={`slot-${s.key}-label`}
                        hint="e.g. Perfume, Spray, Candle"
                      >
                        <Input
                          id={`slot-${s.key}-label`}
                          value={s.label}
                          maxLength={40}
                          onChange={(ev) => updateSlot(s.key, { label: ev.target.value })}
                          className="h-11"
                        />
                      </Field>
                      <Field
                        label="Quantity"
                        htmlFor={`slot-${s.key}-qty`}
                        hint="How many of these"
                      >
                        <Input
                          id={`slot-${s.key}-qty`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={10}
                          value={s.qty}
                          onChange={(ev) =>
                            updateSlot(s.key, { qty: Math.max(1, Number(ev.target.value) || 1) })
                          }
                          className="h-11"
                        />
                      </Field>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-7"
                      disabled={slots.length <= 2}
                      onClick={() => setSlots((all) => all.filter((x) => x.key !== s.key))}
                      aria-label={`Remove item ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <ScopeList
                    title="Categories"
                    options={categories}
                    value={s.categoryIds}
                    onChange={(categoryIds) => updateSlot(s.key, { categoryIds })}
                  />
                  <ScopeList
                    title="Products"
                    options={products}
                    value={s.productIds}
                    onChange={(productIds) => updateSlot(s.key, { productIds })}
                  />
                </li>
              ))}
            </ol>
            {slots.length < 6 ? (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => setSlots((all) => [...all, newSlot(`s${nextSlot.current++}`)])}
              >
                <Plus /> Add item
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={limitProducts}
                onChange={(ev) => setLimitProducts(ev.target.checked)}
                className="accent-primary mt-0.5 size-4"
              />
              <span>
                Only for certain categories or products
                <span className="text-muted-foreground block text-xs">
                  Otherwise it applies to everything. An item counts when its category or the
                  product itself is ticked.
                </span>
              </span>
            </label>
            {limitProducts ? (
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <ScopeList
                  title="Categories"
                  name="categoryIds"
                  options={categories}
                  selected={offer?.categoryIds ?? []}
                />
                <ScopeList
                  title="Products"
                  name="productIds"
                  options={products}
                  selected={offer?.productIds ?? []}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">Where and when</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">
            Where it applies <span className="text-destructive">*</span>
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
              <label key={c} className="flex min-h-8 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked={channels.includes(c)}
                  className="accent-primary size-4"
                />
                {CHANNEL_LABELS[c]}
              </label>
            ))}
          </div>
          {e.channels ? (
            <p className="text-destructive text-sm">{e.channels}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Website checkout, the till at events, or both.
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={limitDates}
              onChange={(ev) => setLimitDates(ev.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Only between certain dates
              <span className="text-muted-foreground block text-xs">
                Otherwise it runs from now until you pause or delete it.
              </span>
            </span>
          </label>
          {limitDates ? (
            <div className="grid gap-5 rounded-lg border p-4 sm:grid-cols-2">
              <Field
                label="Starts on"
                htmlFor="startsOn"
                error={e.startsOn}
                hint="From 00:00 UAE time — leave empty to start now"
              >
                <Input
                  id="startsOn"
                  name="startsOn"
                  type="date"
                  defaultValue={offer?.startsOn ?? ""}
                  className="h-11"
                />
              </Field>
              <Field
                label="Ends on"
                htmlFor="endsOn"
                error={e.endsOn}
                hint="Until 23:59 UAE time — leave empty for no end"
              >
                <Input
                  id="endsOn"
                  name="endsOn"
                  type="date"
                  defaultValue={offer?.endsOn ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
          ) : null}
        </div>

        <Field
          label="Order"
          htmlFor="sort"
          error={e.sort}
          hint="Lower first — tried before others when an item could get more than one offer"
          className="max-w-48"
        >
          <Input
            id="sort"
            name="sort"
            inputMode="numeric"
            defaultValue={offer?.sort ?? 0}
            className="h-11"
          />
        </Field>
      </section>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={offer?.active ?? true}
          className="accent-primary size-4"
        />
        Live — applies automatically within its dates
      </label>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : offer ? "Save changes" : "Create offer"}
      </Button>
    </form>
  );
}

/** The `value` input with its unit (% or AED) at the end. */
function ValueInput({
  value,
  onChange,
  unit,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="relative">
      <Input
        id="value"
        name="value"
        inputMode="decimal"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className="h-11 pe-12"
      />
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
        {unit}
      </span>
    </div>
  );
}
