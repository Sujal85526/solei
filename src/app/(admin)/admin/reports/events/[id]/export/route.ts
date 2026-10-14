import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { fileSlug, tableToCsv, workbookToXlsx, XLSX_TYPE } from "@/modules/reports/excel";
import { isUuid } from "@/modules/reports/params";
import { eventReportFacts } from "@/modules/reports/queries";
import { eventCsvTable, eventWorkbook } from "@/modules/reports/tables";

/**
 * Event report download. `?format=xlsx` (default): summary, products, destinations &
 * categories, payments, stock, expenses (financial only) and one sheet per day.
 * `?format=csv`: one row per day × product. Cost columns only with reports.financial.view —
 * the database omits them otherwise.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/reports/events/[id]/export">,
) {
  try {
    await assertPermission("reports.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const [facts] = await eventReportFacts([id]);
  if (!facts) return new Response("Not found", { status: 404 });

  const name = `solei-event-report-${fileSlug(facts.event.name)}-${facts.event.start_date}`;
  const headers = { "Cache-Control": "private, no-store" };

  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new Response(tableToCsv(eventCsvTable(facts)), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
      },
    });
  }

  const body = await workbookToXlsx(eventWorkbook(facts));
  return new Response(new Uint8Array(body), {
    headers: {
      ...headers,
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
