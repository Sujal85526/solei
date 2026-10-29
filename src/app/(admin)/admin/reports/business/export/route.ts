import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { businessCsvTable, businessWorkbook } from "@/modules/reports/business-tables";
import { parseFormat, reportDownload } from "@/modules/reports/download";
import { businessReport } from "@/modules/reports/queries";
import { parseIdleDays, parseReportRange } from "@/modules/reports/range";

/**
 * Business report download for the range on screen (`?range=` or `?from=&to=`).
 * `?format=xlsx` (default) or `pdf`: overview, P&L (financial only), channels & payments,
 * products, customers, stock, months. `?format=csv`: units and sales per product and size.
 */
export async function GET(request: NextRequest) {
  try {
    await assertPermission("reports.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const range = parseReportRange(sp);
  const report = await businessReport(range);
  return reportDownload(
    parseFormat(sp.format ?? null),
    `solei-business-report-${range.from}-to-${range.to}`,
    businessWorkbook(report, parseIdleDays(sp.idle)),
    businessCsvTable(report),
  );
}
