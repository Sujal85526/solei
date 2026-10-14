"use client";

import Link from "next/link";
import { Logo, OrnamentDivider } from "@/components/brand";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { storeNav } from "@/content/site";
import { t } from "@/content/en";

/** Loaded on first open so the dialog code stays out of the initial store bundle. */
export default function SiteMenuSheet({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="theme-store border-pink/10 bg-noir text-pearl w-[86vw] max-w-sm p-8"
      >
        <SheetTitle className="sr-only">{t.nav.menu}</SheetTitle>
        <Logo className="text-pink h-8 self-start" />
        <OrnamentDivider className="my-6" />
        <nav aria-label="Menu">
          <ul className="flex flex-col gap-1">
            {storeNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="font-display text-pink block py-3 text-4xl font-light"
                >
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
            <li className="mt-6">
              <Link
                href="/track"
                onClick={() => setOpen(false)}
                className="eyebrow text-pearl/70 block py-3"
              >
                {t.nav.trackOrder}
              </Link>
            </li>
          </ul>
        </nav>
        <p className="font-display text-pink/80 mt-auto text-xl italic">{t.brand.tagline}</p>
      </SheetContent>
    </Sheet>
  );
}
