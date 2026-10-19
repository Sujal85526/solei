"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, LogOut, MoreHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/components/brand";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { t } from "@/content/en";
import { signOutAction } from "@/modules/auth/actions";
import { adminNav, isActive, type AdminNavItem } from "./nav-config";

export type AdminUser = { name: string; role: string; permissions?: string[] | "all" };

function visible(items: AdminNavItem[], user: AdminUser) {
  if (!user.permissions || user.permissions === "all") return items;
  const granted = new Set(user.permissions);
  return items.filter((i) => !i.permission || granted.has(i.permission));
}

const COLLAPSED_KEY = "solei.admin.sidebar-collapsed";

export function AdminShell({ user, children }: { user: AdminUser; children: ReactNode }) {
  const pathname = usePathname();
  // Desktop sidebar: full width or a slim icon rail; the choice is remembered on this device.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved choice after hydration
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  };
  const items = visible(adminNav, user);
  const primary = items.filter((i) => i.primary).slice(0, 4);
  const rest = items.filter((i) => !primary.includes(i));

  return (
    <div className="theme-admin bg-background flex min-h-dvh">
      {/* Desktop / iPad landscape sidebar */}
      <aside
        data-collapsed={collapsed || undefined}
        className={cn(
          "bg-sidebar text-sidebar-foreground sticky top-0 hidden h-dvh shrink-0 flex-col transition-[width] duration-300 ease-(--ease-soft) lg:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-20 items-center gap-2",
            collapsed ? "justify-center px-2" : "justify-between ps-6 pe-3",
          )}
        >
          {collapsed ? null : (
            <Link href="/admin" aria-label={t.admin.title}>
              <Logo className="text-pink h-7" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-10 items-center justify-center rounded-md transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] rtl:-scale-x-100" strokeWidth={1.6} />
            ) : (
              <PanelLeftClose className="size-[18px] rtl:-scale-x-100" strokeWidth={1.6} />
            )}
          </button>
        </div>
        <nav aria-label="Admin" className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <SidebarLink
                  item={item}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                />
              </li>
            ))}
          </ul>
        </nav>
        <div
          className={cn(
            "border-sidebar-border border-t text-sm",
            collapsed ? "flex flex-col items-center gap-1 p-2" : "p-4",
          )}
        >
          {collapsed ? (
            <>
              <Link
                href="/"
                title={t.admin.nav.viewStore}
                aria-label={t.admin.nav.viewStore}
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent flex size-10 items-center justify-center rounded-md"
              >
                <ExternalLink className="size-4" />
              </Link>
              <form action={signOutAction}>
                <button
                  title={t.admin.nav.signOut}
                  aria-label={t.admin.nav.signOut}
                  className="text-sidebar-foreground/80 hover:bg-sidebar-accent flex size-10 items-center justify-center rounded-md"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </>
          ) : (
            <>
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
                <form action={signOutAction}>
                  <button className="text-sidebar-foreground/80 hover:bg-sidebar-accent inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs">
                    <LogOut className="size-3.5" /> {t.admin.nav.signOut}
                  </button>
                </form>
              </div>
            </>
          )}
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

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: AdminNavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const label = t.admin.nav[item.key];
  if (item.soon) {
    return (
      <span
        aria-disabled="true"
        title={`${label} — ${t.nav.soon}`}
        className={cn(
          "text-sidebar-foreground/40 flex h-11 cursor-default items-center gap-3 rounded-md text-sm whitespace-nowrap",
          collapsed ? "justify-center px-0" : "px-3",
        )}
      >
        <Icon className="size-[18px] shrink-0" strokeWidth={1.6} />
        {collapsed ? null : (
          <>
            {label}
            <SoonTag />
          </>
        )}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md text-sm whitespace-nowrap transition-colors",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.6} />
      {collapsed ? null : label}
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
            if (item.soon) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="bg-card text-muted-foreground/60 flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-xs"
                  >
                    <Icon className="size-5" strokeWidth={1.6} />
                    {t.admin.nav[item.key]}
                    <SoonTag />
                  </span>
                </li>
              );
            }
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
        <div className="mt-2 flex gap-2 border-t pt-4">
          <Link
            href="/"
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border text-sm"
          >
            <ExternalLink className="size-4" /> {t.admin.nav.viewStore}
          </Link>
          <form action={signOutAction} className="flex-1">
            <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border text-sm">
              <LogOut className="size-4" /> {t.admin.nav.signOut}
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Small "Soon" pill for features that aren't launched yet. */
function SoonTag() {
  return (
    <span className="rounded-full border border-current px-1.5 py-px text-[0.55rem] tracking-[0.15em] uppercase opacity-80">
      {t.nav.soon}
    </span>
  );
}
