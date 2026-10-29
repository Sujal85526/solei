import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { workbookToXlsx, XLSX_TYPE } from "@/modules/reports/excel";
import { staffPerformance } from "@/modules/staff-report/queries";
import { reportRange, staffWorkbook } from "@/modules/staff-report/report";

/** Staff performance download (Excel) for `?from=&to=`. Hours only with staff.manage. */
export async function GET(request: NextRequest) {
  let staff;
  try {
    staff = await assertPermission("reports.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const sp = request.nextUrl.searchParams;
  const { from, to } = reportRange(sp.get("from"), sp.get("to"));
  const rows = await staffPerformance(from, to);
  const body = await workbookToXlsx(
    staffWorkbook(rows, from, to, can(staff.permissions, "staff.manage")),
  );
  return new Response(new Uint8Array(body), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="solei-staff-report-${from}-to-${to}.xlsx"`,
    },
  });
}
