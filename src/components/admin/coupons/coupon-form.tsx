"use client";

import { useState } from "react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { filsToAed } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveCouponAction } from "@/modules/coupons/actions";
import type { Coupon, CouponKind } from "@/modules/coupons/schema";

type ScopeOption = { id: string; name: string; active: boolean };

/**
 * Create or edit a promotion (discount code). Only the code and what it gives are required; every
 * rule below them is optional and left empty means "no limit".
 */
export function CouponForm({
  coupon,
  products,
  categories,
}: {
  coupon?: Coupon;
  products: ScopeOption[];
  categories: ScopeOption[];
}) {
  const [state, action, pending] = useFormAction(saveCouponAction, null);
  const e = useActionToast(state);
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [limitProducts, setLimitProducts] = useState(
    (coupon?.productIds.length ?? 0) + (coupon?.categoryIds.length ?? 0) > 0,
  );
  const [limitDates, setLimitDates] = useState(Boolean(coupon?.startsOn || coupon?.endsOn));

  const value =
    coupon?.kind === "percent"
      ? String((coupon.percentBp ?? 0) / 100)
      : coupon?.amountFils
        ? String(filsToAed(coupon.amountFils))
        : "";

  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      {coupon ? <input type="hidden" name="id" value={coupon.id} /> : null}

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <h2 className="font-sans text-base font-medium">Promotion</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Code"
            htmlFor="code"
            error={e.code}
            hint="What customers type at checkout, e.g. SUMMER20 or WELCOME"
            required
          >
            <Input
              id="code"
              name="code"
              defaultValue={coupon?.code}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-11 font-mono uppercase"
            />
          </Field>
          <Field
            label="Note (staff only)"
            htmlFor="description"
            error={e.description}
            hint="e.g. Instagram giveaway, October"
          >
            <Input
              id="description"
              name="description"
              defaultValue={coupon?.description ?? ""}
              className="h-11"
            />
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1.5 text-sm font-medium">
            What it gives <span className="text-destructive">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["percent", "Percentage off"],
                ["fixed", "Fixed amount off (AED)"],
                ["free_delivery", "Free delivery"],
              ] as const
            ).map(([k, label]) => (
              <label
                key={k}
                className={cn(
                  "flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm",
                  kind === k ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
          {kind === "free_delivery" ? (
            <p className="text-muted-foreground text-xs">
              Waives the delivery fee; the products are charged in full.
            </p>
          ) : (
            <>
              <Field
                label={kind === "percent" ? "Percentage" : "Amount in AED"}
                htmlFor="value"
                error={e.value}
                hint={
                  kind === "percent"
                    ? "e.g. 10 for 10% off the items"
                    : "e.g. 50 for AED 50 off — never more than the items cost"
                }
                className="max-w-48"
              >
                <div className="relative">
                  <Input
                    id="value"
                    name="value"
                    inputMode="decimal"
                    defaultValue={value}
                    className="h-11 pe-12"
                  />
                  <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 flex items-center text-sm">
                    {kind === "percent" ? "%" : "AED"}
                  </span>
                </div>
              </Field>
              <p className="text-muted-foreground text-xs">
                Comes off the products only — delivery is always charged in full.
              </p>
            </>
          )}
        </fieldset>
      </section>

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <div>
          <h2 className="font-sans text-base font-medium">Rules</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            All optional — leave a box empty for no limit.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Total uses"
            htmlFor="maxUses"
            error={e.maxUses}
            hint="e.g. 50 — the first 50 orders can use it"
          >
            <Input
              id="maxUses"
              name="maxUses"
              inputMode="numeric"
              defaultValue={coupon?.maxUses ?? ""}
              className="h-11"
            />
          </Field>
          <Field
            label="Minimum order (AED)"
            htmlFor="minOrder"
            error={e.minOrder}
            hint="Products total before the discount"
          >
            <Input
              id="minOrder"
              name="minOrder"
              inputMode="decimal"
              defaultValue={coupon?.minOrderFils ? filsToAed(coupon.minOrderFils) : ""}
              className="h-11"
            />
          </Field>
          <Field
            label="Uses per customer"
            htmlFor="perCustomerLimit"
            error={e.perCustomerLimit}
            hint="e.g. 1 — each customer can use it on one order"
          >
            <Input
              id="perCustomerLimit"
              name="perCustomerLimit"
              inputMode="numeric"
              defaultValue={coupon?.perCustomerLimit ?? ""}
              className="h-11"
            />
          </Field>
        </div>

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
                Otherwise it works from now until you pause or delete it.
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
                  defaultValue={coupon?.startsOn ?? ""}
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
                  defaultValue={coupon?.endsOn ?? ""}
                  className="h-11"
                />
              </Field>
            </div>
          ) : null}
        </div>

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
                Otherwise it applies to everything in the bag. An item counts when its category or
                the product itself is ticked.
              </span>
            </span>
          </label>
          {limitProducts ? (
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <ScopeList
                title="Categories"
                name="categoryIds"
                options={categories}
                selected={coupon?.categoryIds ?? []}
              />
              <ScopeList
                title="Products"
                name="productIds"
                options={products}
                selected={coupon?.productIds ?? []}
              />
            </div>
          ) : null}
        </div>
      </section>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={coupon?.active ?? true}
          className="accent-primary size-4"
        />
        Live — customers can use this code
      </label>

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : coupon ? "Save changes" : "Create promotion"}
      </Button>
    </form>
  );
}

function ScopeList({
  title,
  name,
  options,
  selected,
}: {
  title: string;
  name: string;
  options: ScopeOption[];
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </legend>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.id}
              defaultChecked={selected.includes(o.id)}
              className="accent-primary size-4"
            />
            {o.name}
            {!o.active ? <span className="text-muted-foreground text-xs">(hidden)</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
