"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo, OrnamentDivider } from "@/components/brand";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { storeNav } from "@/content/site";
import { t } from "@/content/en";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="-ms-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-current/10"
        aria-label={t.nav.menu}
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </SheetTrigger>
      <SheetContent side="left" className="bg-cream text-burgundy w-[86vw] max-w-sm p-8">
        <SheetTitle className="sr-only">{t.nav.menu}</SheetTitle>
        <Logo className="h-8 self-start" />
        <OrnamentDivider className="my-6" />
        <nav aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {storeNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="font-display block py-3 text-3xl"
                >
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
            <li className="mt-6">
              <Link
                href="/track"
                onClick={() => setOpen(false)}
                className="eyebrow text-gold-ink block py-3"
              >
                {t.nav.trackOrder}
              </Link>
            </li>
          </ul>
        </nav>
        <p className="font-display mt-auto text-lg italic">{t.brand.tagline}</p>
      </SheetContent>
    </Sheet>
  );
}
