import "server-only";
import ExcelJS from "exceljs";
import { businessDay } from "@/lib/dates";
import { toCsv } from "@/modules/customers/csv";
import { csvValue, type Cell, type CellFormat, type Column, type WorkbookModel } from "./tables";

// Brand (DECISIONS T6): burgundy header, pink table heads, gold-ink notes.
const BURGUNDY = "FF460328";
const PINK = "FFF7CDD0";
const GOLD_INK = "FF7A5A2B";
const HAIRLINE = "FFE4D3C8";

const NUM_FMT: Record<CellFormat, string | undefined> = {
  text: undefined,
  int: "#,##0",
  dec: "#,##0.0",
  aed: '"AED" #,##0.00;[Red]-"AED" #,##0.00',
  pct: "0.0%;[Red]-0.0%",
  date: "ddd d mmm yyyy",
};

function cellValue(value: Cell, format: CellFormat): ExcelJS.CellValue {
  if (value === null || value === "") return null;
  if (typeof value === "string") {
    // Business dates are plain YYYY-MM-DD; store as a date so Excel sorts and filters them.
    if (format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00Z`);
    }
    return value;
  }
  if (format === "aed") return value / 100;
  if (format === "pct") return value / 10_000;
  return value;
}

function styleValue(cell: ExcelJS.Cell, format: CellFormat) {
  const fmt = NUM_FMT[format];
  if (fmt) cell.numFmt = fmt;
  if (format !== "text") cell.alignment = { horizontal: "right" };
}

export async function workbookToXlsx(model: WorkbookModel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Solei";
  wb.created = new Date();
  wb.title = model.title;

  for (const sheet of model.sheets) {
    const ws = wb.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const widths: number[] = [];
    const want = (i: number, w: number) => (widths[i] = Math.max(widths[i] ?? 10, w));
    const span = Math.max(
      2,
      ...sheet.blocks.map((b) => (b.kind === "table" ? b.columns.length : 2)),
    );

    // Brand header + subtitle lines.
    ws.mergeCells(1, 1, 1, span);
    const head = ws.getCell(1, 1);
    head.value = model.title;
    head.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BURGUNDY } };
    head.alignment = { vertical: "middle", indent: 1 };
    ws.getRow(1).height = 26;
    const sub = [...model.subtitle, `Exported ${businessDay()} (Asia/Dubai)`].join("   ·   ");
    ws.mergeCells(2, 1, 2, span);
    const subCell = ws.getCell(2, 1);
    subCell.value = sub;
    subCell.font = { size: 9, italic: true, color: { argb: GOLD_INK } };
    subCell.alignment = { indent: 1, wrapText: true, vertical: "top" };
    ws.getRow(2).height = 28;

    let r = 4;
    for (const block of sheet.blocks) {
      if (block.title) {
        const t = ws.getCell(r, 1);
        t.value = block.title;
        t.font = { bold: true, size: 12, color: { argb: BURGUNDY } };
        r += 1;
      }
      if (block.kind === "kv") {
        want(0, 28);
        want(1, 16);
        for (const row of block.rows) {
          ws.getCell(r, 1).value = row.label;
          const c = ws.getCell(r, 2);
          c.value = cellValue(row.value, row.format);
          styleValue(c, row.format);
          c.font = { bold: true };
          ws.getRow(r).eachCell((cell) => {
            cell.border = { bottom: { style: "hair", color: { argb: HAIRLINE } } };
          });
          r += 1;
        }
      } else {
        const header = ws.getRow(r);
        block.columns.forEach((col: Column, i) => {
          const c = header.getCell(i + 1);
          c.value = col.header;
          c.font = { bold: true, color: { argb: BURGUNDY } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } };
          c.alignment = { horizontal: col.format === "text" ? "left" : "right", wrapText: true };
          want(i, Math.max(col.width ?? 12, col.header.length + 2));
        });
        r += 1;
        for (const values of block.rows) {
          block.columns.forEach((col, i) => {
            const c = ws.getCell(r, i + 1);
            c.value = cellValue(values[i] ?? null, col.format);
            styleValue(c, col.format);
            c.border = { bottom: { style: "hair", color: { argb: HAIRLINE } } };
            if (col.format === "text" && typeof values[i] === "string") {
              want(i, Math.min(40, String(values[i]).length + 2));
            }
          });
          r += 1;
        }
        if (block.totals) {
          block.columns.forEach((col, i) => {
            const c = ws.getCell(r, i + 1);
            c.value = cellValue(block.totals![i] ?? null, col.format);
            styleValue(c, col.format);
            c.font = { bold: true };
            c.border = { top: { style: "thin", color: { argb: BURGUNDY } } };
          });
          r += 1;
        }
        if (!block.rows.length) {
          ws.getCell(r, 1).value = "No data";
          ws.getCell(r, 1).font = { italic: true, color: { argb: GOLD_INK } };
          r += 1;
        }
      }
      r += 1;
    }
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function tableToCsv(table: { columns: Column[]; rows: Cell[][] }): string {
  return toCsv(
    table.columns.map((c) =>
      c.format === "aed" && !c.header.includes("AED")
        ? `${c.header} (AED)`
        : c.format === "pct"
          ? `${c.header} (%)`
          : c.header,
    ),
    table.rows.map((row) => table.columns.map((c, i) => csvValue(row[i] ?? null, c.format))),
  );
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function fileSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "event"
  );
}
