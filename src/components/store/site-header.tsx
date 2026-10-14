import Link from "next/link";
import { Logo } from "@/components/brand";
import { t } from "@/content/en";
import { storeNav } from "@/content/site";
import { CartCount } from "./cart/cart-count";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";

const navLink = "eyebrow text-[0.65rem] text-pearl/85 transition-colors hover:text-pink";

export function SiteHeader() {
  return (
    <HeaderShell>
      <a
        href="#main"
        className="focus:bg-pink focus:text-burgundy sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:px-4 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto grid h-16 max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center gap-6 px-5 sm:h-20 sm:px-8 lg:px-14">
        <div className="flex items-center">
          <div className="lg:hidden">
            <MobileMenu />
          </div>
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-9">
              {storeNav.slice(0, 3).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={navLink}>
                    {t.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <Link href="/" aria-label="Solei — home" className="justify-self-center">
          <Logo className="text-pink h-7 sm:h-9" />
        </Link>
        <div className="flex items-center justify-end gap-9">
          <nav aria-label="Secondary" className="hidden lg:block">
            <ul className="flex items-center gap-9">
              {storeNav.slice(3).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={navLink}>
                    {t.nav[item.key]}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/track" className={navLink}>
                  {t.nav.trackOrder}
                </Link>
              </li>
            </ul>
          </nav>
          <Link
            href="/cart"
            className={`${navLink} relative inline-flex min-h-11 items-center gap-1.5`}
          >
            {t.nav.cart}
            <CartCount />
          </Link>
        </div>
      </div>
    </HeaderShell>
  );
}
