import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfCellText, workbookToPdf } from "./pdf";
import type { WorkbookModel } from "./tables";

describe("pdfCellText", () => {
  it("formats cells for paper", () => {
    expect(pdfCellText(28000, "aed")).toBe("AED 280.00");
    expect(pdfCellText(-1250, "aed")).toBe("-AED 12.50");
    expect(pdfCellText(1250, "pct")).toBe("12.5%");
    expect(pdfCellText(12345, "int")).toBe("12,345");
    expect(pdfCellText(2.25, "dec")).toBe("2.3");
    expect(pdfCellText("2026-10-24", "date")).toBe("24 Oct 2026");
    expect(pdfCellText(null, "aed")).toBe("");
    expect(pdfCellText("Capri", "text")).toBe("Capri");
    expect(pdfCellText(123456, "aed", true)).toBe("1,234.56");
  });
});

describe("workbookToPdf", () => {
  const model = (rows: number): WorkbookModel => ({
    title: "Solei · Event report — Test",
    subtitle: ["Pop-up · 24 Oct 2026 (1 day)"],
    sheets: [
      {
        name: "Summary",
        blocks: [
          { kind: "kv", title: "All days", rows: [{ label: "Orders", value: 3, format: "int" }] },
        ],
      },
      {
        name: "Products",
        blocks: [
          {
            kind: "table",
            title: "Units by product",
            columns: [
              { header: "Product", format: "text", width: 30 },
              { header: "Units", format: "int" },
              { header: "Sales", format: "aed" },
            ],
            // Arabic can't be drawn in Helvetica: it must not throw.
            rows: Array.from({ length: rows }, (_, i) => [`عطر Scent ${i}`, i, i * 100]),
            totals: ["Total", rows, 0],
          },
        ],
      },
    ],
  });

  it("writes a PDF; short sections share a page", async () => {
    const bytes = await workbookToPdf(model(5));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Solei · Event report — Test");
  });

  it("breaks long tables over pages", async () => {
    const doc = await PDFDocument.load(await workbookToPdf(model(120)));
    expect(doc.getPageCount()).toBeGreaterThan(3);
  });
});
