import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import type { Block, Cell, CellFormat, Column, WorkbookModel } from "./tables";

/**
 * The same report model as the Excel download, laid out as a printable PDF: A4 landscape, one
 * section per sheet, tables that repeat their header row on every page. Brand colours as the
 * workbook (DECISIONS T6); short sections share a page. Standard Helvetica only: characters it can't draw become "?".
 */

const BURGUNDY = rgb(0x46 / 255, 0x03 / 255, 0x28 / 255);
const PINK = rgb(0xf7 / 255, 0xcd / 255, 0xd0 / 255);
const GOLD_INK = rgb(0x7a / 255, 0x5a / 255, 0x2b / 255);
const HAIRLINE = rgb(0xe4 / 255, 0xd3 / 255, 0xc8 / 255);
const INK = rgb(0.13, 0.11, 0.11);
const WHITE = rgb(1, 1, 1);

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BODY = 8;
const MIN_BODY = 5.5;
const ROW_H = 14;
const CELL_PAD = 6;
/** A text column never claims more than this when sizing (long names are cut with "…"). */
const MAX_TEXT_W = 150;
/** Text columns up to this wide are never squeezed. */
const SHORT_TEXT_W = 52;
/** Tables at least this wide print amounts without the "AED" prefix. */
const WIDE_TABLE = 10;

export const PDF_TYPE = "application/pdf";

/**
 * A cell as it reads on paper: AED amounts, 12.5%, 24 Oct 2026, 1,234. `plainAed` drops the
 * "AED" prefix (wide tables say it once, in the header).
 */
export function pdfCellText(value: Cell, format: CellFormat, plainAed = false): string {
  if (value === null || value === "") return "";
  if (typeof value === "string") {
    return format === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? formatBusinessDate(value)
      : value;
  }
  switch (format) {
    case "aed":
      return plainAed
        ? (value / 100).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : formatAED(value, { alwaysShowFils: true });
    case "pct":
      return `${(value / 100).toFixed(1)}%`;
    case "dec":
      return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case "int":
      return value.toLocaleString("en-US");
    default:
      return String(value);
  }
}

class Writer {
  private page!: PDFPage;
  private y = 0;
  private pages: PDFPage[] = [];
  private readonly drawable: Set<number>;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly model: WorkbookModel,
  ) {
    this.drawable = new Set(font.getCharacterSet());
  }

  /** Swap anything Helvetica (WinAnsi) can't draw, e.g. Arabic, for "?". */
  private clean(text: string): string {
    return Array.from(text.replace(/[  ]/g, " "))
      .map((ch) => (this.drawable.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("");
  }

  private fit(text: string, font: PDFFont, size: number, width: number): string {
    let t = this.clean(text);
    if (font.widthOfTextAtSize(t, size) <= width) return t;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  private text(
    text: string,
    x: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      width?: number;
      right?: boolean;
    },
  ) {
    const font = opts.font ?? this.font;
    const size = opts.size ?? BODY;
    const t = opts.width ? this.fit(text, font, size, opts.width) : this.clean(text);
    const dx = opts.right && opts.width ? opts.width - font.widthOfTextAtSize(t, size) : 0;
    this.page.drawText(t, { x: x + dx, y: this.y, size, font, color: opts.color ?? INK });
  }

  newPage(section: string) {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.page.drawRectangle({ x: 0, y: PAGE_H - 44, width: PAGE_W, height: 44, color: BURGUNDY });
    this.y = PAGE_H - 28;
    this.text(this.model.title, MARGIN, {
      font: this.bold,
      size: 13,
      color: WHITE,
      width: CONTENT_W * 0.7,
    });
    this.text(section, MARGIN + CONTENT_W * 0.7, {
      size: 9,
      color: WHITE,
      width: CONTENT_W * 0.3,
      right: true,
    });
    this.y = PAGE_H - 44 - 18;
    for (const line of this.model.subtitle) {
      this.text(line, MARGIN, { size: 8, color: GOLD_INK, width: CONTENT_W });
      this.y -= 11;
    }
    this.y -= 8;
  }

  /** A sheet of the workbook: on a fresh page, or below the last one when most of a page is left. */
  section(name: string, first: boolean) {
    if (first || this.y < PAGE_H * 0.35) this.newPage(name);
    else this.y -= 6;
    this.text(name, MARGIN, { font: this.bold, size: 14, color: BURGUNDY, width: CONTENT_W });
    this.y -= 22;
  }

  /** Start a new page (same section) unless `needed` points still fit. */
  private room(needed: number, section: string): boolean {
    if (this.y - needed >= MARGIN + 14) return false;
    this.newPage(section);
    return true;
  }

  block(block: Block, section: string) {
    this.room(ROW_H * 3 + (block.title ? 18 : 0), section);
    if (block.title) {
      this.text(block.title, MARGIN, { font: this.bold, size: 11, color: BURGUNDY });
      this.y -= 16;
    }
    if (block.kind === "kv") {
      const labelW = 200;
      const valueW = 120;
      for (const row of block.rows) {
        this.room(ROW_H, section);
        this.text(row.label, MARGIN, { width: labelW - 6 });
        this.text(pdfCellText(row.value, row.format), MARGIN + labelW, {
          font: this.bold,
          width: valueW,
          right: true,
        });
        this.rule(MARGIN, labelW + valueW);
      }
    } else {
      const { widths, size, plainAed } = this.layout(block);
      const headers = block.columns.map((c) => c.header);
      if (plainAed && block.columns.some((c) => c.format === "aed")) {
        this.text("Amounts in AED", MARGIN, { size: 7, color: GOLD_INK });
        this.y -= 11;
      }
      const header = () => {
        this.page.drawRectangle({
          x: MARGIN,
          y: this.y - 4,
          width: CONTENT_W,
          height: ROW_H,
          color: PINK,
        });
        this.cells(block.columns, headers, widths, this.bold, BURGUNDY, size);
        this.y -= ROW_H;
      };
      header();
      for (const values of block.rows) {
        if (this.room(ROW_H, section)) header();
        this.cells(
          block.columns,
          block.columns.map((c, i) => pdfCellText(values[i] ?? null, c.format, plainAed)),
          widths,
          this.font,
          INK,
          size,
        );
        this.rule(MARGIN, CONTENT_W);
      }
      if (!block.rows.length) {
        this.text("No data", MARGIN + 3, { color: GOLD_INK });
        this.y -= ROW_H;
      }
      if (block.totals) {
        if (this.room(ROW_H, section)) header();
        this.page.drawLine({
          start: { x: MARGIN, y: this.y + ROW_H - 4 },
          end: { x: MARGIN + CONTENT_W, y: this.y + ROW_H - 4 },
          thickness: 0.8,
          color: BURGUNDY,
        });
        this.cells(
          block.columns,
          block.columns.map((c, i) => pdfCellText(block.totals![i] ?? null, c.format, plainAed)),
          widths,
          this.bold,
          INK,
          size,
        );
        this.y -= ROW_H;
      }
    }
    this.y -= 14;
  }

  /**
   * Column widths from what the cells hold (header and every value, measured). A table that
   * fits is spread over the page; one that doesn't gets a smaller font (down to MIN_BODY), its
   * numbers keep their full width and the text columns share what is left (cut with "…").
   */
  private layout(block: Extract<Block, { kind: "table" }>) {
    const plainAed = block.columns.length >= WIDE_TABLE;
    const rows = block.totals ? [...block.rows, block.totals] : block.rows;
    const natural = block.columns.map((c, i) => {
      let w = this.bold.widthOfTextAtSize(this.clean(c.header), BODY);
      for (const row of rows) {
        const t = this.clean(pdfCellText(row[i] ?? null, c.format, plainAed));
        w = Math.max(w, this.font.widthOfTextAtSize(t, BODY));
      }
      return c.format === "text" ? Math.min(w, MAX_TEXT_W) : w;
    });
    const total = natural.reduce((t, w) => t + w + CELL_PAD, 0) || 1;
    const size = total <= CONTENT_W ? BODY : Math.max(MIN_BODY, (BODY * CONTENT_W) / total);
    const need = natural.map((w) => (w * size) / BODY + CELL_PAD);
    const sum = need.reduce((t, w) => t + w, 0);
    if (sum <= CONTENT_W) {
      return { widths: need.map((w) => (w * CONTENT_W) / sum), size, plainAed };
    }
    // Short text (order numbers, statuses) keeps its width too; only long text is cut.
    const squeezable = (i: number) =>
      block.columns[i]!.format === "text" && need[i]! > SHORT_TEXT_W;
    const fixed = need.reduce((t, w, i) => t + (squeezable(i) ? 0 : w), 0);
    const longNeed = sum - fixed;
    const left = CONTENT_W - fixed;
    const widths =
      left > longNeed * 0.25
        ? need.map((w, i) => (squeezable(i) ? (w * left) / longNeed : w))
        : need.map((w) => (w * CONTENT_W) / sum);
    return { widths, size, plainAed };
  }

  private cells(
    columns: Column[],
    texts: string[],
    widths: number[],
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    size = BODY,
  ) {
    let x = MARGIN;
    columns.forEach((col, i) => {
      this.text(texts[i] ?? "", x + 3, {
        font,
        size,
        color,
        width: widths[i]! - 6,
        right: col.format !== "text" && col.format !== "date",
      });
      x += widths[i]!;
    });
  }

  /** Hairline under the row just written, then move down a row. */
  private rule(x: number, width: number) {
    this.page.drawLine({
      start: { x, y: this.y - 4 },
      end: { x: x + width, y: this.y - 4 },
      thickness: 0.4,
      color: HAIRLINE,
    });
    this.y -= ROW_H;
  }

  footers() {
    const stamp = `Exported ${formatBusinessDate(businessDay())} (Asia/Dubai)`;
    this.pages.forEach((page, i) => {
      this.page = page;
      this.y = MARGIN - 14;
      this.text(stamp, MARGIN, { size: 7, color: GOLD_INK });
      this.text(`Page ${i + 1} of ${this.pages.length}`, MARGIN, {
        size: 7,
        color: GOLD_INK,
        width: CONTENT_W,
        right: true,
      });
    });
  }
}

export async function workbookToPdf(model: WorkbookModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(model.title);
  doc.setCreator("Solei");
  doc.setProducer("Solei");
  const w = new Writer(
    doc,
    await doc.embedFont(StandardFonts.Helvetica),
    await doc.embedFont(StandardFonts.HelveticaBold),
    model,
  );
  for (const [i, sheet] of model.sheets.entries()) {
    w.section(sheet.name, i === 0);
    for (const block of sheet.blocks) {
      // "Stock" under "Stock": the section heading is enough.
      w.block(block.title === sheet.name ? { ...block, title: undefined } : block, sheet.name);
    }
  }
  if (!model.sheets.length) w.newPage("");
  w.footers();
  return doc.save();
}
