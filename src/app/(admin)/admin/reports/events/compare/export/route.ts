import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { compareRow } from "@/modules/reports/aggregate";
import { tableToCsv, workbookToXlsx, XLSX_TYPE } from "@/modules/reports/excel";
import { MIN_COMPARE, parseCompareIds } from "@/modules/reports/params";
import { eventReportFacts } from "@/modules/reports/queries";
import { compareTable, compareWorkbook } from "@/modules/reports/tables";

/** Comparison download (`?ids=a,b&format=xlsx|csv`); cost columns only with reports.financial.view. */
export async function GET(request: NextRequest) {
  try {
    await assertPermission("reports.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const params = request.nextUrl.searchParams;
  const ids = parseCompareIds(params.getAll("ids"));
  const facts = ids.length >= MIN_COMPARE ? await eventReportFacts(ids) : [];
  if (facts.length < MIN_COMPARE) {
    return new Response(`Choose at least ${MIN_COMPARE} events`, { status: 400 });
  }

  const name = `solei-event-comparison-${businessDay()}`;
  const headers = { "Cache-Control": "private, no-store" };

  if (params.get("format") === "csv") {
    const financial = facts.every((f) => f.financial);
    return new Response(tableToCsv(compareTable(facts.map(compareRow), financial)), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
      },
    });
  }

  const body = await workbookToXlsx(compareWorkbook(facts));
  return new Response(new Uint8Array(body), {
    headers: {
      ...headers,
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
