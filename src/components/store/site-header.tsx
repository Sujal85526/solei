import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Logo } from "@/components/brand";
import { storeNav } from "@/content/site";
import { t } from "@/content/en";
import { CartCount } from "./cart/cart-count";
import { MobileMenu } from "./mobile-menu";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? "text-cream absolute inset-x-0 top-0 z-40"
          : "border-border/60 bg-cream/90 text-burgundy supports-[backdrop-filter]:bg-cream/75 sticky top-0 z-40 border-b backdrop-blur"
      }
    >
      <a
        href="#main"
        className="focus:bg-burgundy focus:text-cream sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:px-4 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-6 px-5 sm:h-20 sm:px-8 lg:px-12">
        <div className="flex flex-1 items-center lg:hidden">
          <MobileMenu />
        </div>
        <nav aria-label="Primary" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-8">
            {storeNav.slice(0, 2).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="eyebrow transition-opacity hover:opacity-70">
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/" aria-label="Solei — home" className="shrink-0">
          <Logo className="h-7 sm:h-8" />
        </Link>
        <div className="flex flex-1 items-center justify-end gap-8">
          <nav aria-label="Secondary" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {storeNav.slice(2).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="eyebrow transition-opacity hover:opacity-70">
                    {t.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/cart"
            className="relative -me-2 inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-current/10"
          >
            <ShoppingBag aria-hidden className="size-5" strokeWidth={1.5} />
            <span className="sr-only">{t.nav.cart}</span>
            <CartCount />
          </Link>
        </div>
      </div>
    </header>
  );
}
