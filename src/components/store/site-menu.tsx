"use client";

import { useState } from "react";
import { MenuIcon } from "@/components/brand";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t } from "@/content/en";
import { MenuLinks } from "./menu-links";

const item =
  "text-pearl/80 hover:text-pink hover:bg-pink/5 block rounded-sm px-3 py-2.5 text-[0.65rem] tracking-[0.28em] uppercase transition-colors";

/** Desktop header menu: a compact dropdown under the icon. */
export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={t.nav.menu} title={t.nav.menu} className={className}>
        <MenuIcon className="size-[1.3rem]" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="theme-store bg-noir border-pink/15 w-60 gap-0 rounded-sm border p-2 shadow-2xl ring-0 shadow-black/50"
      >
        <MenuLinks onNavigate={() => setOpen(false)} itemClassName={item} />
      </PopoverContent>
    </Popover>
  );
}
