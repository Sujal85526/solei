import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { exportCustomers } from "@/modules/customers/queries";
import { parseCustomerFilters } from "@/modules/customers/schema";
import {
  DATED_EXPORTS,
  EXPORT_PERMISSION,
  isExportKind,
  parseRange,
} from "@/modules/exports/params";
import { exportOrders, exportPayments, exportStockLevels } from "@/modules/exports/queries";
import {
  customersTable,
  exportWorkbook,
  ordersTable,
  paymentsTable,
  stockTable,
  type ExportTable,
} from "@/modules/exports/tables";
import { parseFormat, reportDownload } from "@/modules/reports/download";

/**
 * `/admin/exports/{orders|payments|customers|stock}?from=&to=&format=xlsx|pdf|csv`.
 * Orders and payments take an Asia/Dubai date range (default: this month); customers and stock
 * are a snapshot. Excel and PDF include a totals row; CSV is the plain table.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/admin/exports/[kind]">) {
  const { kind } = await ctx.params;
  if (!isExportKind(kind)) return new Response("Not found", { status: 404 });

  let staff;
  try {
    staff = await assertPermission(EXPORT_PERMISSION[kind]);
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }

  const sp = request.nextUrl.searchParams;
  const range = DATED_EXPORTS.includes(kind) ? parseRange(sp) : null;
  let table: ExportTable;
  switch (kind) {
    case "orders":
      table = ordersTable(await exportOrders(range!.from, range!.to));
      break;
    case "payments":
      table = paymentsTable(await exportPayments(range!.from, range!.to));
      break;
    case "stock":
      table = stockTable(await exportStockLevels());
      break;
    case "customers":
      {
        const { page: _page, ...all } = parseCustomerFilters(new URLSearchParams());
        table = customersTable(await exportCustomers(all), can(staff.permissions, "orders.view"));
        break;
      }
      break;
  }

  const name = range
    ? `solei-${kind}-${range.from}-to-${range.to}`
    : `solei-${kind}-${businessDay()}`;
  return reportDownload(
    parseFormat(sp.get("format")),
    name,
    exportWorkbook(kind, table, range),
    table,
  );
}
