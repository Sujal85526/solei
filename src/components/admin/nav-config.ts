import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  Gift,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  Star,
  ShieldCheck,
  Store,
  TicketPercent,
  Users,
  Inbox,
  History,
} from "lucide-react";
import type { en } from "@/content/en";

export type AdminNavKey = keyof (typeof en)["admin"]["nav"];

export type AdminNavItem = {
  href: string;
  key: AdminNavKey;
  icon: LucideIcon;
  /** Permission required to see the item; filtered server-side once auth lands. */
  permission?: string;
  /** Shown in the mobile bottom bar (max 4; the rest go under "More"). */
  primary?: boolean;
};

export const adminNav: AdminNavItem[] = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, primary: true },
  { href: "/admin/pos", key: "pos", icon: Store, permission: "pos.use", primary: true },
  {
    href: "/admin/orders",
    key: "orders",
    icon: ClipboardList,
    permission: "orders.view",
    primary: true,
  },
  {
    href: "/admin/calendar",
    key: "calendar",
    icon: CalendarDays,
    permission: "events.view",
    primary: true,
  },
  { href: "/admin/bookings", key: "bookings", icon: Inbox, permission: "bookings.view" },
  { href: "/admin/products", key: "products", icon: Package, permission: "catalog.view" },
  { href: "/admin/inventory", key: "inventory", icon: Boxes, permission: "inventory.view" },
  { href: "/admin/reviews", key: "reviews", icon: Star, permission: "reviews.manage" },
  { href: "/admin/customers", key: "customers", icon: Users, permission: "customers.view" },
  { href: "/admin/coupons", key: "coupons", icon: TicketPercent, permission: "coupons.manage" },
  { href: "/admin/loyalty", key: "loyalty", icon: Gift, permission: "loyalty.view" },
  { href: "/admin/reports", key: "reports", icon: BarChart3, permission: "reports.view" },
  { href: "/admin/staff", key: "staff", icon: ShieldCheck, permission: "staff.manage" },
  { href: "/admin/settings", key: "settings", icon: Settings, permission: "settings.manage" },
  { href: "/admin/activity", key: "activity", icon: History, permission: "audit.view" },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}
