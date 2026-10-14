"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { getCartDetails } from "@/modules/cart/actions";
import type { CartDetails } from "@/modules/cart/details";
import type { Emirate } from "@/modules/cart/schema";
import { cart, useCart } from "@/modules/cart/store";
import { placeOrderAction } from "@/modules/checkout/actions";

type Zone = { emirate: Emirate; name: string; feeFils: number };

const inputCls = "h-12 bg-cream";

export function CheckoutForm({ zones }: { zones: Zone[] }) {
  const state = useCart();
  const [details, setDetails] = useState<CartDetails | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [, startLoad] = useTransition();
  // Idempotency key for this checkout, created on first submit (re-submits reuse it).
  const clientUuid = useRef<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const req = useRef(0);
  const key = state ? JSON.stringify([state.lines, state.emirate]) : null;

  useEffect(() => {
    if (!state || !state.lines.length) return;
    const id = ++req.current;
    startLoad(async () => {
      const res = await getCartDetails({ lines: state.lines, emirate: state.emirate });
      if (id === req.current) setDetails(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!state) return <p className="text-ink-muted text-sm">Loading…</p>;
  if (!state.lines.length && !redirecting) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="font-display text-burgundy text-2xl">{t.checkout.empty}</p>
        <Link href="/shop" className="eyebrow text-burgundy underline underline-offset-4">
          Shop the collection
        </Link>
      </div>
    );
  }

  const pricing = details?.pricing;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state) return;
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    setErrors({});
    setFormError(null);
    startSubmit(async () => {
      clientUuid.current ??= crypto.randomUUID();
      const res = await placeOrderAction({
        ...fd,
        clientUuid: clientUuid.current,
        lines: state.lines,
      });
      if (res.ok) {
        setRedirecting(true);
        window.location.assign(res.data.redirectUrl);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
      // Stock or prices may have changed — refresh the summary.
      const fresh = await getCartDetails({ lines: state.lines, emirate: state.emirate });
      setDetails(fresh);
      const allowed = new Map(
        fresh.lines.filter((l) => l.status !== "ok").map((l) => [l.variantId, l.qty]),
      );
      if (allowed.size) cart.reconcile(allowed);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="flex flex-col gap-10 lg:col-span-7">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="eyebrow text-gold-ink mb-4">{t.checkout.contact}</legend>
          <Field
            label={t.checkout.name}
            htmlFor="name"
            error={errors.name}
            required
            className="sm:col-span-2"
          >
            <Input id="name" name="name" autoComplete="name" className={inputCls} />
          </Field>
          <Field
            label={t.checkout.phone}
            htmlFor="phone"
            error={errors.phone}
            hint={t.checkout.phoneHint}
            required
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050 123 4567"
              className={inputCls}
            />
          </Field>
          <Field label={t.checkout.email} htmlFor="email" error={errors.email} required>
            <Input id="email" name="email" type="email" autoComplete="email" className={inputCls} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="eyebrow text-gold-ink mb-4">{t.checkout.delivery}</legend>
          <Field
            label={t.checkout.line1}
            htmlFor="line1"
            error={errors.line1}
            required
            className="sm:col-span-2"
          >
            <Input id="line1" name="line1" autoComplete="address-line1" className={inputCls} />
          </Field>
          <Field
            label={t.checkout.line2}
            htmlFor="line2"
            error={errors.line2}
            className="sm:col-span-2"
          >
            <Input id="line2" name="line2" autoComplete="address-line2" className={inputCls} />
          </Field>
          <Field label={t.checkout.area} htmlFor="area" error={errors.area} required>
            <Input id="area" name="area" autoComplete="address-level3" className={inputCls} />
          </Field>
          <Field label={t.checkout.city} htmlFor="city" error={errors.city} required>
            <Input id="city" name="city" autoComplete="address-level2" className={inputCls} />
          </Field>
          <Field
            label={t.checkout.emirate}
            htmlFor="emirate"
            error={errors.emirate}
            required
            className="sm:col-span-2"
          >
            <NativeSelect
              id="emirate"
              name="emirate"
              value={state.emirate ?? ""}
              onChange={(e) => cart.setEmirate((e.target.value || null) as Emirate | null)}
              className="[&_select]:bg-cream [&_select]:h-12"
            >
              <option value="" disabled>
                Choose…
              </option>
              {zones.map((z) => (
                <option key={z.emirate} value={z.emirate}>
                  {z.name} — {z.feeFils ? formatAED(z.feeFils) : "free"} delivery
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            label={t.checkout.notes}
            htmlFor="notes"
            error={errors.notes}
            className="sm:col-span-2"
          >
            <Textarea id="notes" name="notes" rows={3} className="bg-cream" />
          </Field>
        </fieldset>

        <label className="text-ink-muted flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="marketingConsent"
            className="accent-burgundy mt-0.5 size-5 shrink-0"
          />
          {t.checkout.consent}
        </label>
      </div>

      <aside className="lg:col-span-5">
        <div className="bg-sand sticky top-28 flex flex-col gap-5 p-6 sm:p-8">
          <h2 className="eyebrow text-burgundy">{t.checkout.summary}</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {(details?.lines ?? [])
              .filter((l) => l.qty > 0)
              .map((l) => (
                <li key={l.variantId} className="flex justify-between gap-4">
                  <span>
                    {l.product?.name}
                    {l.hasVariants ? ` · ${l.variantLabel}` : ""}{" "}
                    <span className="text-ink-muted">× {l.qty}</span>
                  </span>
                  <span className="numeric">{formatAED(l.lineTotalFils)}</span>
                </li>
              ))}
          </ul>
          <dl className="numeric border-burgundy/15 flex flex-col gap-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{pricing ? formatAED(pricing.subtotalFils) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>
                {pricing?.deliveryFeeFils == null
                  ? "Choose emirate"
                  : pricing.deliveryFeeFils === 0
                    ? "Free"
                    : formatAED(pricing.deliveryFeeFils)}
              </dd>
            </div>
            {pricing ? (
              <div className="text-ink-muted flex justify-between">
                <dt>{pricing.vatIncluded ? "Includes VAT" : "VAT"}</dt>
                <dd>{formatAED(pricing.vatFils)}</dd>
              </div>
            ) : null}
            <div className="border-burgundy/15 mt-2 flex items-baseline justify-between border-t pt-4">
              <dt className="font-display text-burgundy text-lg">Total</dt>
              <dd className="font-display text-burgundy text-2xl">
                {pricing ? formatAED(pricing.totalFils) : "—"}
              </dd>
            </div>
          </dl>
          {formError ? (
            <p role="alert" className="bg-pink-wash text-burgundy px-4 py-3 text-sm">
              {formError}
            </p>
          ) : null}
          <Button type="submit" size="cta" disabled={submitting || redirecting || !pricing}>
            <Lock className="size-3.5" />
            {submitting || redirecting
              ? t.checkout.paying
              : t.checkout.pay(pricing ? formatAED(pricing.totalFils) : "")}
          </Button>
          <p className="text-ink-muted text-xs">{t.checkout.secure}</p>
          <Link
            href="/cart"
            className="eyebrow text-burgundy inline-flex items-center gap-2 text-[0.65rem] hover:opacity-70"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" /> {t.checkout.backToCart}
          </Link>
        </div>
      </aside>
    </form>
  );
}
