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
import type { CodeTargets } from "@/modules/coupons/queries";
import type { Coupon, CouponKind } from "@/modules/coupons/schema";
import { NativeSelect } from "@/components/ui/native-select";

type ScopeOption = { id: string; name: string; active: boolean };

/**
 * Create or edit a promotion (discount code). Only the code and what it gives are required; every
 * rule below them is optional and left empty means "no limit".
 */
export function CouponForm({
  coupon,
  products,
  categories,
  targets,
}: {
  coupon?: Coupon;
  products: ScopeOption[];
  categories: ScopeOption[];
  /** Events, VIP tiers and segments a code can be tied to. */
  targets: CodeTargets;
}) {
  const [state, action, pending] = useFormAction(saveCouponAction, null);
  const e = useActionToast(state);
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [limitProducts, setLimitProducts] = useState(
    (coupon?.productIds.length ?? 0) + (coupon?.categoryIds.length ?? 0) > 0,
  );
  const [limitDates, setLimitDates] = useState(Boolean(coupon?.startsOn || coupon?.endsOn));
  const [limitWho, setLimitWho] = useState(Boolean(coupon?.tierIds.length || coupon?.segmentId));

  const value =
    coupon?.kind === "percent" || coupon?.kind === "buy_x_get_y"
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
                ["buy_x_get_y", "Buy X get Y"],
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
          ) : kind === "buy_x_get_y" ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Buy" htmlFor="buyQty" error={e.buyQty} hint="Items paid in full">
                  <Input
                    id="buyQty"
                    name="buyQty"
                    inputMode="numeric"
                    defaultValue={coupon?.buyQty ?? 2}
                    className="h-11"
                  />
                </Field>
                <Field label="Get" htmlFor="getQty" error={e.getQty} hint="Items discounted">
                  <Input
                    id="getQty"
                    name="getQty"
                    inputMode="numeric"
                    defaultValue={coupon?.getQty ?? 1}
                    className="h-11"
                  />
                </Field>
                <Field label="% off them" htmlFor="value" error={e.value} hint="100 = free">
                  <Input
                    id="value"
                    name="value"
                    inputMode="decimal"
                    defaultValue={coupon ? value : "100"}
                    className="h-11"
                  />
                </Field>
              </div>
              <p className="text-muted-foreground text-xs">
                The cheapest items are the ones discounted, e.g. buy 2 get 1 free on 3 sprays: the
                cheapest spray is free.
              </p>
            </>
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

      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <div>
          <h2 className="font-sans text-base font-medium">Where and who</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Codes work on the website unless you also tick the event till.
          </p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">Works on</legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["website", "Website checkout"],
                ["pos", "Event till"],
              ] as const
            ).map(([ch, label]) => (
              <label key={ch} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="channels"
                  value={ch}
                  defaultChecked={(coupon?.channels ?? ["website"]).includes(ch)}
                  className="accent-primary size-4"
                />
                {label}
              </label>
            ))}
          </div>
          {e.channels ? <p className="text-destructive text-xs">{e.channels}</p> : null}
        </fieldset>
        <Field
          label="Event"
          htmlFor="eventId"
          error={e.eventId}
          hint="Optional — shows this code's sales per event in Reports. At the till it then works only at that event."
        >
          <NativeSelect id="eventId" name="eventId" defaultValue={coupon?.eventId ?? ""}>
            <option value="">No event</option>
            {targets.events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {ev.startDate}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="combinable"
            defaultChecked={coupon?.combinable ?? false}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            Can be combined
            <span className="text-muted-foreground block text-xs">
              Works together with other combinable codes and on items already on sale or in an
              offer. Otherwise it is the only code on the order and skips reduced items.
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={limitWho}
              onChange={(ev) => setLimitWho(ev.target.checked)}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Only for VIP tiers or a customer segment
              <span className="text-muted-foreground block text-xs">
                Customers must be signed in (website) or found by mobile / email (till).
              </span>
            </span>
          </label>
          {limitWho ? (
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <fieldset>
                <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  VIP tiers
                </legend>
                <div className="flex flex-wrap gap-4">
                  {targets.tiers.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="tierIds"
                        value={t.id}
                        defaultChecked={coupon?.tierIds.includes(t.id)}
                        className="accent-primary size-4"
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field
                label="Or customers in a segment"
                htmlFor="segmentId"
                error={e.segmentId}
                hint="The customers in the segment when you save (save again to refresh the list)."
              >
                <NativeSelect
                  id="segmentId"
                  name="segmentId"
                  defaultValue={coupon?.segmentId ?? ""}
                >
                  <option value="">No segment</option>
                  {targets.segments.map((sg) => (
                    <option key={sg.id} value={sg.id}>
                      {sg.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {coupon?.customerIds.length ? (
                <p className="text-muted-foreground text-xs">
                  {coupon.birthday
                    ? "A personal birthday code for one customer."
                    : `${coupon.customerIds.length} customer${coupon.customerIds.length === 1 ? "" : "s"} can use it now.`}
                </p>
              ) : null}
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
