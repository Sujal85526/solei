/** Reports → Promotions as a workbook (Excel / PDF / CSV), one row per code. */
import type { PromotionReportRow } from "@/modules/coupons/queries";
import { rangeLabel } from "./business-tables";
import type { Cell, Column, WorkbookModel } from "./tables";

const COLUMNS: Column[] = [
  { header: "Code", format: "text", width: 18 },
  { header: "Orders", format: "int" },
  { header: "Discount", format: "aed" },
  { header: "Delivery waived", format: "aed" },
  { header: "Sales", format: "aed" },
];

export function promotionsTable(rows: PromotionReportRow[]) {
  const total = (f: (r: PromotionReportRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    columns: COLUMNS,
    rows: rows.map((r): Cell[] => [
      r.code,
      r.orders,
      r.discountFils,
      r.deliveryDiscountFils,
      r.salesFils,
    ]),
    totals: [
      "Total",
      total((r) => r.orders),
      total((r) => r.discountFils),
      total((r) => r.deliveryDiscountFils),
      total((r) => r.salesFils),
    ] as Cell[],
  };
}

export function promotionsWorkbook(
  rows: PromotionReportRow[],
  range: { from: string; to: string },
): WorkbookModel {
  return {
    title: "Solei — Promotions",
    subtitle: [rangeLabel(range), "Paid website orders that used a discount code."],
    sheets: [{ name: "Promotions", blocks: [{ kind: "table", ...promotionsTable(rows) }] }],
  };
}
