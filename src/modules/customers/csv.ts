/**
 * Minimal RFC 4180 CSV writer with spreadsheet formula-injection protection: a cell that a
 * spreadsheet would evaluate (=, @, tab/CR, or +/- not followed by a plain number) is prefixed
 * with an apostrophe. Phone numbers like "+971501234567" are left intact.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join(" ") : String(value);
  if (/^[=@\t\r]/.test(s) || /^[+-](?!\d+(\.\d+)?$)/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (Arabic names) correctly.
  return "﻿" + [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}
