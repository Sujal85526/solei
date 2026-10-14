"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { OrnamentDivider } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { useCartCount } from "@/modules/cart/store";

export type AddedItem = {
  name: string;
  variantLabel: string;
  destinationName: string | null;
  image: { url: string; alt: string };
  qty: number;
  unitPriceFils: number;
};

/** Slide-in confirmation after "Add to cart" — the added line plus the way onward. */
export function AddedSheet({
  item,
  open,
  onOpenChange,
}: {
  item: AddedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const count = useCartCount() ?? 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-cream text-ink w-full gap-0 p-0 sm:max-w-md"
        data-testid="added-sheet"
      >
        <div className="flex flex-col gap-2 px-6 pt-8 pb-6 sm:px-8">
          <p className="eyebrow text-gold-ink flex items-center gap-2 text-[0.65rem]">
            <span className="bg-burgundy text-pink flex size-5 items-center justify-center rounded-full">
              <Check className="size-3" strokeWidth={2.5} />
            </span>
            {t.cart.added}
          </p>
          <SheetTitle className="font-display text-burgundy text-3xl font-medium">
            {item?.name ?? t.cart.added}
          </SheetTitle>
          <SheetDescription className="text-ink-muted text-sm">
            {t.cart.itemsInCart(count)}
          </SheetDescription>
        </div>
        {item ? (
          <div className="border-burgundy/10 flex gap-5 border-y px-6 py-6 sm:px-8">
            <div className="bg-sand relative aspect-[4/5] w-24 shrink-0 overflow-hidden">
              <Image src={item.image.url} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {item.destinationName ? (
                <p className="eyebrow text-gold-ink text-[0.6rem]">{item.destinationName}</p>
              ) : null}
              <p className="font-display text-burgundy text-lg leading-snug">{item.name}</p>
              <p className="text-ink-muted text-sm">
                {[item.variantLabel, `× ${item.qty}`].filter(Boolean).join("  ·  ")}
              </p>
              <p className="numeric text-burgundy mt-auto text-sm font-medium">
                {formatAED(item.unitPriceFils * item.qty)}
              </p>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 px-6 py-8 sm:px-8">
          <Link
            href="/cart"
            onClick={() => onOpenChange(false)}
            className={buttonVariants({ size: "cta", className: "w-full" })}
          >
            {t.cart.viewCart}
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={buttonVariants({ size: "cta", variant: "outline", className: "w-full" })}
          >
            {t.cart.continueShopping}
          </button>
        </div>
        <div className="mt-auto px-6 pb-8 sm:px-8">
          <OrnamentDivider />
          <p className="font-display text-burgundy mt-4 text-center text-lg italic">
            {t.brand.tagline}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
