"use client";

import Image from "next/image";
import Link from "next/link";
import { Gift, ShieldCheck, Trash2, Truck } from "lucide-react";
import { SideDrawer } from "@/components/store/side-drawer";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartDetailLine } from "@/modules/cart/details";
import { cartDrawer, useCartDrawerOpen } from "@/modules/cart/drawer";
import { MAX_LINE_QTY } from "@/modules/cart/schema";
import { cart } from "@/modules/cart/store";
import { useCartDetails } from "@/modules/cart/use-cart-details";
import { freeDeliveryProgress } from "@/modules/orders/pricing";
import { noticesFor } from "./cart-view";
import { QtyStepper } from "./qty-stepper";

/**
 * Slide-in cart from the right (header bag, "Add to cart"): free-delivery progress, lines with
 * quantity and remove, the subtotal (shipping is worked out at checkout) and the way to checkout.
 * Prices come from the server.
 */
export function CartDrawer() {
  const open = useCartDrawerOpen();
  const { state, details, byVariant, notices, stale } = useCartDetails({
    enabled: open,
    describe: noticesFor,
  });
  const count = state?.lines.reduce((s, l) => s + l.qty, 0) ?? 0;
  const pricing = details?.pricing;
  const threshold = details?.settings.freeDeliveryThresholdFils ?? null;

  return (
    <SideDrawer
      open={open}
      onOpenChange={cartDrawer.set}
      side="end"
      title={t.cart.drawerTitle(count)}
      header={
        <h2 className="font-display text-burgundy text-3xl leading-none sm:text-4xl">
          {t.cart.drawerTitle(count)}
        </h2>
      }
      closeLabel={t.cart.close}
      className="w-[92vw] max-w-md overflow-y-auto px-6 sm:px-8"
    >
      {!count ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="font-display text-burgundy text-2xl italic">{t.cart.empty}</p>
          <Link
            href="/shop"
            onClick={cartDrawer.close}
            className={buttonVariants({ size: "cta", className: "rounded-none" })}
          >
            {t.cart.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          {threshold !== null ? (
            <div className="border-burgundy/20 mt-7 flex items-center gap-4 border px-4 py-3.5">
              <Gift className="text-burgundy size-6 shrink-0" strokeWidth={1.25} aria-hidden />
              <div className="flex-1">
                <p className="text-burgundy text-[0.8rem]">
                  {!pricing
                    ? "…"
                    : pricing.amountToFreeDeliveryFils !== null
                      ? t.cart.spendMore(formatAED(pricing.amountToFreeDeliveryFils))
                      : t.cart.freeDeliveryUnlocked}
                </p>
                <div
                  className="bg-burgundy/10 mt-2 h-1.5 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(
                    freeDeliveryProgress(pricing?.subtotalFils ?? 0, threshold) * 100,
                  )}
                  aria-label={t.cart.delivery}
                >
                  <div
                    className="bg-burgundy h-full rounded-full transition-[width] duration-700 ease-(--ease-soft)"
                    style={{
                      width: `${freeDeliveryProgress(pricing?.subtotalFils ?? 0, threshold) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {notices.length ? (
            <ul className="mt-5 flex flex-col gap-2" aria-live="polite">
              {notices.map((n) => (
                <li key={n} className="bg-burgundy/5 text-burgundy px-3 py-2 text-xs">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}

          <ul className="divide-burgundy/15 border-burgundy/15 mt-5 divide-y border-b">
            {state!.lines.map((line, i) => (
              <li
                key={line.variantId}
                className="drawer-item"
                style={{ "--i": i } as React.CSSProperties}
              >
                <DrawerLine qty={line.qty} detail={byVariant.get(line.variantId)} />
              </li>
            ))}
          </ul>

          <dl
            className={cn(
              "text-burgundy mt-5 flex flex-col gap-2 text-sm transition-opacity",
              stale && "opacity-60",
            )}
            aria-busy={stale}
          >
            <div className="flex justify-between gap-4">
              <dt className="font-medium">{t.cart.subtotal}</dt>
              <dd className="numeric font-medium" data-testid="drawer-subtotal">
                {pricing ? formatAED(pricing.subtotalFils) : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>{t.cart.shipping}</dt>
              <dd className="text-burgundy/60">
                {pricing?.amountToFreeDeliveryFils === null && threshold !== null
                  ? t.cart.free
                  : t.cart.shippingAtCheckout}
              </dd>
            </div>
            <p className="text-burgundy/55 mt-1 text-xs">{t.cart.inclVat}</p>
          </dl>

          <Link
            href="/checkout"
            onClick={cartDrawer.close}
            aria-disabled={stale}
            className={cn(
              buttonVariants({ size: "cta", className: "mt-6 h-14 w-full shrink-0 rounded-none" }),
              stale && "pointer-events-none opacity-60",
            )}
            data-testid="drawer-checkout"
          >
            {t.cart.proceedToCheckout} →
          </Link>

          <div className="text-burgundy mt-6 grid grid-cols-2 pb-2 text-xs">
            <div className="flex items-center justify-center gap-3">
              <Truck className="size-6 shrink-0" strokeWidth={1.1} aria-hidden />
              <span>
                {t.cart.fastDelivery}
                <span className="text-burgundy/55 block">{t.cart.fastDeliveryNote}</span>
              </span>
            </div>
            <div className="border-burgundy/15 flex items-center justify-center gap-3 border-s">
              <ShieldCheck className="size-6 shrink-0" strokeWidth={1.1} aria-hidden />
              <span>
                {t.cart.secureCheckout}
                <span className="text-burgundy/55 block">{t.cart.secureCheckoutNote}</span>
              </span>
            </div>
          </div>
        </>
      )}
    </SideDrawer>
  );
}

function DrawerLine({ qty, detail }: { qty: number; detail: CartDetailLine | undefined }) {
  if (!detail?.product) {
    return (
      <div className="flex gap-4 py-5" aria-busy>
        <div className="bg-burgundy/10 size-20 shrink-0 animate-pulse" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <div className="bg-burgundy/10 h-4 w-24 animate-pulse" />
          <div className="bg-burgundy/10 h-3 w-32 animate-pulse" />
        </div>
      </div>
    );
  }
  const p = detail.product;
  const max = Math.max(1, Math.min(MAX_LINE_QTY, detail.available));
  return (
    <div className="flex gap-4 py-5" data-testid="drawer-line">
      <Link
        href={`/products/${p.slug}`}
        onClick={cartDrawer.close}
        className="relative size-20 shrink-0 overflow-hidden sm:size-24"
        tabIndex={-1}
        aria-hidden
      >
        <Image src={p.image.url} alt="" fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/products/${p.slug}`}
              onClick={cartDrawer.close}
              className="font-display text-burgundy text-lg leading-tight tracking-[0.04em] uppercase"
            >
              {p.destinationName ?? p.name}
            </Link>
            <p className="text-burgundy/60 mt-0.5 text-xs">
              {[p.typeLabel, detail.variantLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="numeric text-burgundy shrink-0 text-sm font-medium">
            {formatAED(detail.unitPriceFils * qty)}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <QtyStepper
            value={Math.min(qty, max)}
            max={max}
            size="md"
            onChange={(n) => cart.setQty(detail.variantId, n)}
            shape="square"
            label={`${t.product.quantity}: ${p.name}`}
          />
          <button
            type="button"
            onClick={() => cart.remove(detail.variantId)}
            aria-label={t.cart.removeItem(p.name)}
            className="text-burgundy/70 hover:text-burgundy -me-2 flex size-10 items-center justify-center transition-colors"
          >
            <Trash2 className="size-4" strokeWidth={1.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
