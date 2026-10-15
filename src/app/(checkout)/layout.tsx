import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Logo } from "@/components/brand";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { t } from "@/content/en";

/**
 * Checkout: a calm, light page — "Continue shopping" back to the collection, the logo (home) and a
 * secure note; no store navigation.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  const side =
    "text-muted-foreground flex items-center gap-2 text-[0.65rem] tracking-[0.25em] uppercase";
  return (
    <div className="theme-light flex min-h-dvh flex-col">
      <header className="border-border border-b">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 sm:px-10">
          <Link
            href="/shop"
            className={`${side} hover:text-primary justify-self-start transition-colors`}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t.checkout.continueShopping}</span>
            <span className="sr-only sm:hidden">{t.checkout.continueShopping}</span>
          </Link>
          <Link href="/" aria-label="Solei — home">
            <Logo className="text-burgundy h-7" title="" />
          </Link>
          <p className={`${side} justify-self-end`}>
            <Lock className="size-3.5" strokeWidth={1.5} aria-hidden />
            <span className="hidden sm:inline">{t.checkout.secure}</span>
          </p>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      {/* "Bag" / "Return to bag" open the same side drawer as in the store. */}
      <div className="theme-store">
        <CartDrawer />
      </div>
    </div>
  );
}
