"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ExternalLink, LogOut, MoreHorizontal } from "lucide-react";
import { Logo } from "@/components/brand";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { t } from "@/content/en";
import { adminNav, isActive, type AdminNavItem } from "./nav-config";

export type AdminUser = { name: string; role: string; permissions?: string[] | "all" };

function visible(items: AdminNavItem[], user: AdminUser) {
  if (!user.permissions || user.permissions === "all") return items;
  const granted = new Set(user.permissions);
  return items.filter((i) => !i.permission || granted.has(i.permission));
}

export function AdminShell({ user, children }: { user: AdminUser; children: ReactNode }) {
  const pathname = usePathname();
  const items = visible(adminNav, user);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));

  return (
    <div className="theme-admin bg-background flex min-h-dvh">
      {/* Desktop / iPad landscape sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh w-64 shrink-0 flex-col lg:flex">
        <div className="flex h-20 items-center px-6">
          <Link href="/admin" aria-label={t.admin.title}>
            <Logo className="text-pink h-7" />
          </Link>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-sidebar-border border-t p-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-sidebar-foreground/70 text-xs capitalize">
            {user.role.replace("_", " ")}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/"
              className="text-sidebar-foreground/80 hover:bg-sidebar-accent inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs"
            >
              <ExternalLink className="size-3.5" /> {t.admin.nav.viewStore}
            </Link>
            <form action="/admin/sign-out" method="post">
              <button className="text-sidebar-foreground/80 hover:bg-sidebar-accent inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs">
                <LogOut className="size-3.5" /> {t.admin.nav.signOut}
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="bg-card/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur lg:hidden">
          <Link href="/admin" aria-label={t.admin.title}>
            <Logo className="text-burgundy h-6" />
          </Link>
          <span className="text-muted-foreground text-xs">{user.name}</span>
        </header>

        <main id="main" className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:pb-10">
          {children}
        </main>

        {/* Mobile / iPad portrait bottom navigation — large tap targets */}
        <nav
          aria-label="Admin"
          className="bg-card/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="grid grid-cols-5">
            {primary.map((item) => (
              <li key={item.href}>
                <BottomLink item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
            <li>
              <MoreSheet items={rest} pathname={pathname} />
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function SidebarLink({ item, active }: { item: AdminNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.6} />
      {t.admin.nav[item.key]}
    </Link>
  );
}

function BottomLink({ item, active }: { item: AdminNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem]",
        active ? "text-burgundy" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
          active && "bg-pink",
        )}
      >
        <Icon className="size-5" strokeWidth={1.6} />
      </span>
      {t.admin.nav[item.key]}
    </Link>
  );
}

function MoreSheet({ items, pathname }: { items: AdminNavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = items.some((i) => isActive(pathname, i.href));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem]",
          active ? "text-burgundy" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-7 w-12 items-center justify-center rounded-full",
            active && "bg-pink",
          )}
        >
          <MoreHorizontal className="size-5" strokeWidth={1.6} />
        </span>
        {t.admin.nav.more}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetTitle className="px-2 text-lg">{t.admin.nav.more}</SheetTitle>
        <ul className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const on = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-xs",
                    on ? "border-burgundy bg-pink-wash text-burgundy" : "bg-card",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.6} />
                  {t.admin.nav[item.key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
