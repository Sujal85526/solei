"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MenuIcon } from "@/components/brand";
import { t } from "@/content/en";

const SiteMenuSheet = dynamic(() => import("./site-menu-sheet"), { ssr: false });

/** Header menu button (every screen size); the sheet loads on first open. */
export function SiteMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        aria-label={t.nav.menu}
        aria-expanded={open}
        title={t.nav.menu}
        className={className}
      >
        <MenuIcon className="size-[1.3rem]" />
      </button>
      {loaded ? <SiteMenuSheet open={open} setOpen={setOpen} /> : null}
    </>
  );
}
