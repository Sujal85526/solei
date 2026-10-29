import "server-only";
import { tableToCsv, workbookToXlsx, XLSX_TYPE } from "./excel";
import { PDF_TYPE, workbookToPdf } from "./pdf";
import type { Cell, Column, WorkbookModel } from "./tables";

export type DownloadFormat = "xlsx" | "pdf" | "csv";

export const parseFormat = (v: string | null): DownloadFormat =>
  v === "pdf" || v === "csv" ? v : "xlsx";

/** A report download: the workbook as Excel or PDF, or one table as CSV. Never cached. */
export async function reportDownload(
  format: DownloadFormat,
  name: string,
  model: WorkbookModel,
  csv: { columns: Column[]; rows: Cell[][] },
): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store" };
  if (format === "csv") {
    return new Response(tableToCsv(csv), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.csv"`,
      },
    });
  }
  const body = format === "pdf" ? await workbookToPdf(model) : await workbookToXlsx(model);
  return new Response(new Uint8Array(body), {
    headers: {
      ...headers,
      "Content-Type": format === "pdf" ? PDF_TYPE : XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${name}.${format}"`,
    },
  });
}
