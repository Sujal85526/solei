"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Logo, MenuIcon } from "@/components/brand";
import { t } from "@/content/en";
import { MenuLinks } from "./menu-links";

const item =
  "menu-drawer-link text-burgundy/85 hover:text-burgundy block py-3 text-[0.7rem] tracking-[0.3em] uppercase transition-colors";

/**
 * Phone header menu: a baby-pink drawer that glides in from the left over a dimmed overlay, links easing in
 * one after another (globals.css "Menu drawer"). Escape, the overlay or the close button dismiss it.
 */
export function SiteMenuDrawer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger aria-label={t.nav.menu} title={t.nav.menu} className={className}>
        <MenuIcon className="size-[1.3rem]" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="menu-drawer-backdrop bg-noir/60 fixed inset-0 z-50 backdrop-blur-[2px]" />
        <Dialog.Popup className="menu-drawer on-blush bg-pink text-burgundy fixed inset-y-0 start-0 z-50 flex w-[78vw] max-w-xs flex-col px-7 pt-6 pb-8 shadow-2xl shadow-black/40 outline-none">
          <div className="flex items-center justify-between">
            <Logo className="text-burgundy h-6" title="" />
            <Dialog.Close
              aria-label={t.nav.closeMenu}
              className="text-burgundy/70 hover:text-burgundy -me-2 flex size-10 items-center justify-center transition-colors"
            >
              <X className="size-5" strokeWidth={1.25} />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">{t.nav.menu}</Dialog.Title>
          <div className="mt-10">
            <MenuLinks
              onNavigate={() => setOpen(false)}
              itemClassName={item}
              dividerClassName="bg-burgundy/15 my-4"
            />
          </div>
          <p className="font-display text-burgundy/70 mt-auto text-lg italic">{t.brand.tagline}</p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
