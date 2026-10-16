"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AccountForms } from "@/components/store/account/account-forms";
import { refreshAccount } from "@/components/store/account/use-account";
import { SideDrawer } from "@/components/store/side-drawer";
import { t } from "@/content/en";

/** "Sign in to view progress": opens the same light sign-in panel as the header. */
export function PassportSignInButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-pink text-burgundy hover:bg-pink/90 inline-flex h-12 items-center gap-3 px-6 text-[0.7rem] tracking-[0.22em] whitespace-nowrap uppercase transition-colors"
      >
        {t.passport.signInCta} <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
      </button>
      <SideDrawer
        open={open}
        onOpenChange={setOpen}
        side="end"
        title={t.passport.signInTitle}
        header={<span />}
        closeLabel="Close"
        className="theme-light w-[90vw] max-w-sm overflow-y-auto px-7 sm:px-8"
      >
        <div className="mt-4 pb-4">
          {open ? (
            <AccountForms
              onSignedIn={async () => {
                await refreshAccount();
                setOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </SideDrawer>
    </>
  );
}
