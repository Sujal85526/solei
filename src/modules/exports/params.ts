import { z } from "zod";
import { businessDay } from "@/lib/dates";
import type { PermissionKey } from "@/lib/permissions";

export const EXPORT_KINDS = ["orders", "payments", "customers", "stock"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const EXPORT_LABELS: Record<ExportKind, string> = {
  orders: "Orders",
  payments: "Payments",
  customers: "Customers",
  stock: "Stock levels",
};

export const EXPORT_PERMISSION: Record<ExportKind, PermissionKey> = {
  orders: "orders.view",
  payments: "orders.view",
  customers: "customers.view",
  stock: "inventory.view",
};

/** Kinds filtered by a date range (customers and stock are a snapshot of now). */
export const DATED_EXPORTS: readonly ExportKind[] = ["orders", "payments"];

export const MAX_RANGE_DAYS = 366;

const day = z.iso.date();

export function isExportKind(v: string): v is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(v);
}

/**
 * `?from=&to=` (Asia/Dubai dates). Defaults to the first of this month → today; swapped if
 * reversed; clamped to MAX_RANGE_DAYS ending at `to`.
 */
export function parseRange(
  sp: URLSearchParams,
  today: string = businessDay(),
): { from: string; to: string } {
  const pick = (k: string) => {
    const v = sp.get(k);
    return v && day.safeParse(v).success ? v : null;
  };
  let from = pick("from") ?? `${today.slice(0, 8)}01`;
  let to = pick("to") ?? today;
  if (from > to) [from, to] = [to, from];
  const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const earliest = new Date(ms(to) - (MAX_RANGE_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  if (from < earliest) from = earliest;
  return { from, to };
}
