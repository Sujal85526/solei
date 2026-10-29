/** Reports → Promotions as a workbook (Excel / PDF / CSV), one row per promotion. */
import type { PromotionPerformanceRow } from "@/modules/promotions/queries";
import { PROMOTION_KIND_LABELS } from "@/modules/promotions/schema";
import { rangeLabel } from "./business-tables";
import type { Cell, Column, WorkbookModel } from "./tables";

const COLUMNS: Column[] = [
  { header: "Promotion", format: "text", width: 28 },
  { header: "Type", format: "text", width: 14 },
  { header: "Code", format: "text", width: 16 },
  { header: "Event", format: "text", width: 22 },
  { header: "Orders", format: "int" },
  { header: "Discount given", format: "aed" },
  { header: "Delivery waived", format: "aed" },
  { header: "Sales", format: "aed" },
];

export function promotionsTable(rows: PromotionPerformanceRow[]) {
  const total = (f: (r: PromotionPerformanceRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    columns: COLUMNS,
    rows: rows.map((r): Cell[] => [
      r.name,
      PROMOTION_KIND_LABELS[r.kind],
      r.code ?? "",
      r.eventName ?? "",
      r.orders,
      r.discountFils,
      r.deliveryDiscountFils,
      r.salesFils,
    ]),
    // An order with two promotions counts under both, so the sales column isn't totalled.
    totals: [
      "Total",
      "",
      "",
      "",
      total((r) => r.orders),
      total((r) => r.discountFils),
      total((r) => r.deliveryDiscountFils),
      "",
    ] as Cell[],
  };
}

export function promotionsWorkbook(
  rows: PromotionPerformanceRow[],
  range: { from: string; to: string },
): WorkbookModel {
  return {
    title: "Solei — Promotions",
    subtitle: [
      rangeLabel(range),
      "Paid orders (website and event till) with a code, a sale price, a bundle or a buy X get Y offer.",
    ],
    sheets: [{ name: "Promotions", blocks: [{ kind: "table", ...promotionsTable(rows) }] }],
  };
}
