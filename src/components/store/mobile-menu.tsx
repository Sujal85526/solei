"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Menu } from "lucide-react";
import { t } from "@/content/en";

const MobileMenuSheet = dynamic(() => import("./mobile-menu-sheet"), { ssr: false });

export function MobileMenu() {
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
        className="-ms-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-current/10"
      >
        <Menu className="text-pearl size-5" strokeWidth={1.25} />
      </button>
      {loaded ? <MobileMenuSheet open={open} setOpen={setOpen} /> : null}
    </>
  );
}
