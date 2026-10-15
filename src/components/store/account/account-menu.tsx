"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { accountCopy as c } from "@/content/account";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/modules/account/actions";
import { SideDrawer } from "../side-drawer";
import { AccountForms, type AccountMode } from "./account-forms";
import { refreshAccount, useAccount } from "./use-account";

const item =
  "text-pearl/80 hover:text-pink hover:bg-pink/5 block w-full rounded-sm px-4 py-3 text-start text-[0.65rem] tracking-[0.28em] uppercase transition-colors";

/**
 * Header account icon: a small dropdown — "Welcome / Solei" with Sign in and Create account, or,
 * when signed in, the customer's name with My account, Orders and Sign out. Sign in and Create
 * account open the light account drawer from the right.
 */
export function AccountMenu({ className }: { className?: string }) {
  const account = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState<AccountMode | null>(null);
  const [, start] = useTransition();
  const signedIn = account.status === "signed_in";

  const openDrawer = (mode: AccountMode) => {
    setOpen(false);
    setDrawer(mode);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={c.menu.label}
          title={c.menu.label}
          className={cn("relative", className)}
        >
          <UserRound className="size-[1.15rem]" strokeWidth={1.25} aria-hidden />
          {signedIn ? (
            <span aria-hidden className="bg-pink absolute end-2 top-2 size-1.5 rounded-full" />
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="theme-store bg-noir border-pink/15 w-64 gap-0 rounded-sm border p-0 shadow-2xl ring-0 shadow-black/50"
        >
          <div className="border-pink/10 border-b px-5 pt-5 pb-4">
            <p className="text-pearl-muted text-[0.6rem] tracking-[0.32em] uppercase">
              {c.menu.welcome}
            </p>
            <p className="font-display text-pink mt-1 truncate text-2xl italic">
              {signedIn ? account.firstName : c.menu.brand}
            </p>
          </div>
          <div className="p-2">
            {signedIn ? (
              <>
                <Link href="/account" onClick={() => setOpen(false)} className={item}>
                  {c.menu.myAccount}
                </Link>
                <Link href="/account#orders" onClick={() => setOpen(false)} className={item}>
                  {c.menu.orders}
                </Link>
                <button
                  type="button"
                  className={item}
                  onClick={() =>
                    start(async () => {
                      await signOutAction();
                      await refreshAccount();
                      setOpen(false);
                      router.refresh();
                    })
                  }
                >
                  {c.menu.signOut}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={item} onClick={() => openDrawer("signIn")}>
                  {c.menu.signIn}
                </button>
                <button type="button" className={item} onClick={() => openDrawer("signUp")}>
                  {c.menu.createAccount}
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <SideDrawer
        open={drawer !== null}
        onOpenChange={(o) => !o && setDrawer(null)}
        side="end"
        title={drawer === "signUp" ? c.menu.createAccount : c.menu.signIn}
        header={<span />}
        closeLabel="Close"
        className="theme-light w-[90vw] max-w-sm overflow-y-auto px-7 sm:px-8"
      >
        <div className="mt-4 pb-4">
          {drawer ? (
            <AccountForms
              key={drawer}
              initialMode={drawer}
              onSignedIn={async () => {
                await refreshAccount();
                setDrawer(null);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </SideDrawer>
    </>
  );
}
