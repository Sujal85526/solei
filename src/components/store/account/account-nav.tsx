"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { accountCopy as c } from "@/content/account";
import { cn } from "@/lib/utils";
import { SignOutLink } from "./profile-forms";
import { useAccount } from "./use-account";

const links = [
  { href: "/account", label: c.menu.myAccount },
  { href: "/account/orders", label: c.menu.orders },
  { href: "/passport", label: c.menu.passport },
];

/** Tabs between the account pages (shown once signed in). */
export function AccountNav() {
  const pathname = usePathname();
  const account = useAccount();
  if (account.status !== "signed_in") return null;
  return (
    <nav
      aria-label={c.menu.label}
      className="border-border mb-10 flex items-center justify-between gap-4 border-b"
    >
      <ul className="-mb-px flex gap-6 sm:gap-8">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b py-3 text-[0.62rem] tracking-[0.22em] uppercase transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-primary border-transparent",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <SignOutLink />
    </nav>
  );
}
