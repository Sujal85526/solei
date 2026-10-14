"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "@/components/brand";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { storeNav } from "@/content/site";
import { t } from "@/content/en";

const item =
  "text-pearl/80 hover:text-pink hover:bg-pink/5 block rounded-sm px-3 py-2.5 text-[0.65rem] tracking-[0.28em] uppercase transition-colors";

/** Header menu: a compact dropdown under the icon with every store page (all screen sizes). */
export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={t.nav.menu} title={t.nav.menu} className={className}>
        <MenuIcon className="size-[1.3rem]" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="theme-store bg-noir/95 border-pink/15 w-60 gap-0 rounded-sm border p-2 shadow-2xl ring-0 shadow-black/50 backdrop-blur-md"
      >
        <nav aria-label="Menu">
          <ul>
            {storeNav.map((link) => (
              <li key={link.href}>
                <Link href={link.href} onClick={close} className={item}>
                  {t.nav[link.key]}
                </Link>
              </li>
            ))}
          </ul>
          <div className="bg-pink/10 mx-3 my-2 h-px" />
          <Link href="/track" onClick={close} className={item}>
            {t.nav.trackOrder}
          </Link>
        </nav>
      </PopoverContent>
    </Popover>
  );
}
