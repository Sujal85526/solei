"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Info, Lock, X } from "lucide-react";
import { ArchPalm, Eyebrow, OrnamentDivider } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartDetailLine } from "@/modules/cart/details";
import { emirateSchema, MAX_LINE_QTY } from "@/modules/cart/schema";
import { cart } from "@/modules/cart/store";
import { useCartDetails } from "@/modules/cart/use-cart-details";
import { freeDeliveryProgress } from "@/modules/orders/pricing";
import type { DeliveryZone } from "@/modules/storefront/types";
import { QtyStepper } from "./qty-stepper";

/**
 * The cart page body. The browser holds { variantId, qty }; everything shown (names, prices,
 * availability, delivery, VAT, totals) comes from `getCartDetails` on the server.
 */
export function CartView({
  zones,
  freeDeliveryThresholdFils,
}: {
  zones: DeliveryZone[];
  freeDeliveryThresholdFils: number | null;
}) {
  const { state, details, byVariant, error, notices, stale, retry, dismiss } = useCartDetails({
    describe: noticesFor,
  });

  if (!state) return <CartSkeleton />;
  if (!state.lines.length) return <EmptyCart notices={notices} />;

  const pricing = details?.pricing;
  const subtotal = pricing?.subtotalFils ?? 0;
  const threshold = details?.settings.freeDeliveryThresholdFils ?? freeDeliveryThresholdFils;
  const itemCount = state.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <section aria-labelledby="cart-lines-title" className="lg:col-span-7">
        <h2 id="cart-lines-title" className="sr-only">
          {t.cart.items(itemCount)}
        </h2>
        {notices.length ? (
          <ul className="mb-8 flex flex-col gap-2" aria-live="polite">
            {notices.map((n) => (
              <li key={n} className="bg-pink/10 text-pink flex items-start gap-3 px-4 py-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1">{n}</span>
                <button
                  type="button"
                  onClick={() => dismiss(n)}
                  className="-m-2 inline-flex size-8 items-center justify-center"
                  aria-label={t.cart.dismiss}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <div className="bg-pink/10 text-pink mb-8 flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>{t.cart.error}</span>
            <button type="button" className="underline underline-offset-4" onClick={retry}>
              {t.cart.retry}
            </button>
          </div>
        ) : null}
        <ul className="border-pink/15 divide-pink/10 divide-y border-y">
          {state.lines.map((line) => (
            <CartLineRow
              key={line.variantId}
              qty={line.qty}
              detail={byVariant.get(line.variantId)}
            />
          ))}
        </ul>
        <Link
          href="/shop"
          className="eyebrow text-pink mt-8 inline-flex items-center gap-2 text-[0.7rem] hover:opacity-70"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.5} />
          {t.cart.continueShopping}
        </Link>
      </section>

      <aside
        aria-labelledby="summary-title"
        className="bg-card h-fit p-6 shadow-[0_1px_2px_rgb(70_3_40/0.06),0_20px_40px_-24px_rgb(70_3_40/0.25)] sm:p-8 lg:sticky lg:top-28 lg:col-span-5"
      >
        <h2 id="summary-title" className="text-3xl">
          {t.cart.summary}
        </h2>
        <OrnamentDivider className="my-6" />

        <label className="flex flex-col gap-2">
          <span className="eyebrow text-pink/70 text-[0.65rem]">{t.cart.deliveryTo}</span>
          <NativeSelect
            value={state.emirate ?? ""}
            onChange={(e) => {
              const parsed = emirateSchema.safeParse(e.target.value);
              cart.setEmirate(parsed.success ? parsed.data : null);
            }}
            className="[&_select]:h-12 [&_select]:text-base"
            data-testid="emirate-select"
          >
            <option value="">{t.cart.chooseEmirate}</option>
            {zones.map((z) => (
              <option key={z.emirate} value={z.emirate}>
                {z.name} — {formatAED(z.feeFils)}
              </option>
            ))}
          </NativeSelect>
        </label>

        {threshold !== null && pricing ? (
          <div className="mt-6 flex flex-col gap-2" data-testid="free-delivery">
            <div
              className="bg-wine h-1 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(freeDeliveryProgress(subtotal, threshold) * 100)}
              aria-label={t.cart.delivery}
            >
              <div
                className="bg-burgundy h-full rounded-full transition-[width] duration-700 ease-(--ease-soft)"
                style={{ width: `${freeDeliveryProgress(subtotal, threshold) * 100}%` }}
              />
            </div>
            <p className="text-pearl-muted text-sm">
              {pricing.amountToFreeDeliveryFils !== null
                ? t.cart.awayFromFree(formatAED(pricing.amountToFreeDeliveryFils))
                : t.cart.freeDeliveryUnlocked}
            </p>
          </div>
        ) : null}

        <dl
          className={cn(
            "mt-8 flex flex-col gap-3 text-sm transition-opacity duration-300",
            stale && "opacity-60",
          )}
          aria-busy={stale}
          data-testid="cart-summary"
        >
          <Row label={t.cart.subtotal} testId="summary-subtotal">
            {pricing ? formatAED(pricing.subtotalFils) : "—"}
          </Row>
          <Row label={t.cart.delivery} testId="summary-delivery">
            {!pricing ? (
              "—"
            ) : pricing.deliveryFeeFils === null ? (
              <span className="text-pearl-muted text-xs">{t.cart.chooseEmirateHint}</span>
            ) : pricing.deliveryFeeFils === 0 ? (
              <span className="eyebrow text-pink/70 text-[0.65rem]">{t.cart.free}</span>
            ) : (
              formatAED(pricing.deliveryFeeFils)
            )}
          </Row>
          {pricing && !pricing.vatIncluded ? (
            <Row label={t.cart.vat}>{formatAED(pricing.vatFils)}</Row>
          ) : null}
          <div className="border-pink/15 mt-3 flex items-baseline justify-between gap-4 border-t pt-5">
            <dt className="eyebrow text-pink">{t.cart.total}</dt>
            <dd className="numeric font-display text-pink text-3xl" data-testid="summary-total">
              {pricing ? formatAED(pricing.totalFils) : "—"}
            </dd>
          </div>
          {pricing?.vatIncluded && pricing.vatFils > 0 ? (
            <p className="text-pearl-muted text-end text-xs" data-testid="summary-vat">
              {t.cart.vatIncluded(formatAED(pricing.vatFils, { alwaysShowFils: true }))}
            </p>
          ) : null}
        </dl>

        <Link
          href="/checkout"
          aria-disabled={stale || !pricing?.itemCount}
          className={cn(
            buttonVariants({ size: "cta", className: "mt-8 h-14 w-full" }),
            (stale || !pricing?.itemCount) && "pointer-events-none opacity-60",
          )}
          data-testid="checkout"
        >
          {t.cart.checkout}
        </Link>
        <p className="text-pearl-muted mt-4 flex items-center justify-center gap-2 text-xs">
          <Lock className="size-3.5" strokeWidth={1.5} />
          {t.cart.secureNote}
        </p>
      </aside>
    </div>
  );
}

function Row({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-pearl-muted">{label}</dt>
      <dd className="numeric text-pearl text-end" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

function CartLineRow({ qty, detail }: { qty: number; detail: CartDetailLine | undefined }) {
  if (!detail?.product) {
    return (
      <li className="flex gap-5 py-6" aria-busy>
        <div className="bg-wine aspect-[4/5] w-24 shrink-0 animate-pulse sm:w-28" />
        <div className="flex flex-1 flex-col gap-3 pt-1">
          <div className="bg-wine h-3 w-20 animate-pulse" />
          <div className="bg-wine h-5 w-40 animate-pulse" />
        </div>
      </li>
    );
  }
  const p = detail.product;
  const max = Math.max(1, Math.min(MAX_LINE_QTY, detail.available));
  return (
    <li className="flex gap-5 py-6 sm:gap-6" data-testid="cart-line">
      <Link
        href={`/products/${p.slug}`}
        className="bg-wine relative aspect-[4/5] w-24 shrink-0 overflow-hidden sm:w-28"
        tabIndex={-1}
        aria-hidden
      >
        <Image src={p.image.url} alt="" fill sizes="112px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            {p.destinationName ? (
              <p className="eyebrow text-pink/70 text-[0.6rem]">{p.destinationName}</p>
            ) : null}
            <Link
              href={`/products/${p.slug}`}
              className="font-display text-pink text-lg leading-snug hover:opacity-80 sm:text-xl"
            >
              {p.name}
            </Link>
            <p className="text-pearl-muted text-sm">
              {[
                detail.variantLabel,
                qty > 1 ? `${formatAED(detail.unitPriceFils)} ${t.cart.each}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <p className="numeric text-pink shrink-0 font-medium" data-testid="line-total">
            {formatAED(detail.unitPriceFils * qty)}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-4 pt-3">
          <QtyStepper
            value={Math.min(qty, max)}
            max={max}
            size="md"
            onChange={(n) => cart.setQty(detail.variantId, n)}
            label={`${t.product.quantity}: ${p.name}`}
          />
          <button
            type="button"
            onClick={() => cart.remove(detail.variantId)}
            className="text-pearl-muted hover:text-pink -me-2 inline-flex h-11 items-center px-2 text-xs tracking-[0.18em] uppercase underline-offset-4 hover:underline"
            aria-label={t.cart.removeItem(p.name)}
          >
            {t.cart.remove}
          </button>
        </div>
      </div>
    </li>
  );
}

export function noticesFor(lines: CartDetailLine[]): string[] {
  return lines.flatMap((l) => {
    if (l.status === "clamped" && l.product) return [t.cart.noticeClamped(l.product.name, l.qty)];
    if (l.status === "sold_out" && l.product) return [t.cart.noticeSoldOut(l.product.name)];
    if (l.status === "unavailable") return [t.cart.noticeUnavailable];
    return [];
  });
}

function EmptyCart({ notices }: { notices: string[] }) {
  return (
    <div
      className="flex flex-col items-center gap-6 py-10 text-center sm:py-16"
      data-testid="cart-empty"
    >
      {notices.map((n) => (
        <p key={n} className="bg-pink/10 text-pink px-4 py-3 text-sm">
          {n}
        </p>
      ))}
      <ArchPalm className="h-40" />
      <Eyebrow lines>{t.cart.eyebrow}</Eyebrow>
      <h2 className="text-4xl sm:text-5xl">{t.cart.empty}</h2>
      <p className="font-display text-pearl/80 max-w-md text-lg italic">{t.cart.emptyLede}</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link href="/shop" className={buttonVariants({ size: "cta" })}>
          {t.cart.emptyCta}
        </Link>
        <Link href="/destinations" className={buttonVariants({ size: "cta", variant: "outline" })}>
          {t.cart.browseDestinations}
        </Link>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16" aria-busy aria-label={t.cart.loading}>
      <div className="flex flex-col gap-6 lg:col-span-7">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-5">
            <div className="bg-wine aspect-[4/5] w-24 animate-pulse sm:w-28" />
            <div className="flex flex-1 flex-col gap-3 pt-1">
              <div className="bg-wine h-3 w-20 animate-pulse" />
              <div className="bg-wine h-5 w-40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="bg-card h-80 animate-pulse lg:col-span-5" />
    </div>
  );
}
