"use client";

import { useState } from "react";
import { Logo, MenuIcon } from "@/components/brand";
import { t } from "@/content/en";
import { MenuLinks } from "./menu-links";
import { SideDrawer } from "./side-drawer";

const item =
  "drawer-item text-burgundy/85 hover:text-burgundy block py-3 text-[0.7rem] tracking-[0.3em] uppercase transition-colors";

/** Phone header menu: the baby-pink drawer from the left with every store page. */
export function SiteMenuDrawer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <SideDrawer
      open={open}
      onOpenChange={setOpen}
      side="start"
      trigger={{ label: t.nav.menu, icon: <MenuIcon className="size-[1.3rem]" />, className }}
      title={t.nav.menu}
      header={<Logo className="text-burgundy h-6" title="" />}
      closeLabel={t.nav.closeMenu}
    >
      <div className="mt-10">
        <MenuLinks
          onNavigate={() => setOpen(false)}
          itemClassName={item}
          dividerClassName="bg-burgundy/15 my-4"
        />
      </div>
      <p className="font-display text-burgundy/70 mt-auto text-lg italic">{t.brand.tagline}</p>
    </SideDrawer>
  );
}
