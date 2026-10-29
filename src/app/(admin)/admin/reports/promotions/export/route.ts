import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { promotionPerformance } from "@/modules/promotions/queries";
import { parseRange } from "@/modules/exports/params";
import { parseFormat, reportDownload } from "@/modules/reports/download";
import { promotionsTable, promotionsWorkbook } from "@/modules/reports/promotions-export";

/** Reports → Promotions download: `?from=&to=&format=xlsx|pdf|csv` (default this month). */
export async function GET(request: NextRequest) {
  try {
    await assertPermission("reports.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const sp = request.nextUrl.searchParams;
  const range = parseRange(sp);
  const rows = await promotionPerformance(range.from, range.to);
  return reportDownload(
    parseFormat(sp.get("format")),
    `solei-promotions-${range.from}-to-${range.to}`,
    promotionsWorkbook(rows, range),
    promotionsTable(rows),
  );
}
