import Link from "next/link";
import { UserRound } from "lucide-react";
import { BagIcon, Logo } from "@/components/brand";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import { storeNav } from "@/content/site";
import { CartCount } from "./cart/cart-count";
import { HeaderShell } from "./header-shell";
import { SiteMenu } from "./site-menu";

const navLink = "eyebrow text-[0.65rem] text-pearl/85 transition-colors hover:text-pink";
const iconLink =
  "text-pearl/85 hover:text-pink inline-flex size-10 items-center justify-center transition-colors";

export function SiteHeader() {
  return (
    <HeaderShell>
      <a
        href="#main"
        className="focus:bg-pink focus:text-burgundy sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:px-4 focus:py-2"
      >
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto grid h-14 max-w-[96rem] grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 sm:h-16 sm:px-8 lg:px-14">
        <div className="flex items-center">
          {/* Phones: the menu sits on the empty left; wide screens show the nav links here. */}
          <SiteMenu className={cn(iconLink, "-ms-2.5 lg:hidden")} align="start" />
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
          <Logo className="text-pink h-6 sm:h-8" />
        </Link>
        <div className="-me-2.5 flex items-center justify-end">
          <Link href="/passport" className={iconLink} title={t.nav.account}>
            <UserRound className="size-[1.15rem]" strokeWidth={1.25} aria-hidden />
            <span className="sr-only">{t.nav.account}</span>
          </Link>
          <Link href="/cart" className={iconLink} title={t.nav.cart}>
            <span className="relative">
              <BagIcon className="size-[1.3rem]" />
              <CartCount />
            </span>
            <span className="sr-only">{t.nav.cart}</span>
          </Link>
          <SiteMenu className={cn(iconLink, "hidden lg:inline-flex")} />
        </div>
      </div>
    </HeaderShell>
  );
}
