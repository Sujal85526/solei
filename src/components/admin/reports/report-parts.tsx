import type { ReactNode } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReportColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Numbers align to the end (tabular). */
  numeric?: boolean;
  /** Row header (first column), sticky while the table scrolls sideways on phones. */
  rowHeader?: boolean;
};

/** Plain data table that scrolls sideways on small screens; first column stays put. */
export function ReportTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  footer,
  empty = "Nothing to show yet.",
  testId,
}: {
  caption: string;
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  footer?: ReactNode[];
  empty?: ReactNode;
  testId?: string;
}) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0 sm:rounded-lg sm:border" data-testid={testId}>
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-muted-foreground text-xs">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "px-3 py-2 font-medium whitespace-nowrap",
                  c.numeric ? "text-end" : "text-start",
                  c.rowHeader && "bg-muted sticky start-0 z-10 sm:bg-transparent",
                  c.rowHeader && "ps-5 sm:ps-3",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) =>
                c.rowHeader ? (
                  <th
                    key={c.key}
                    scope="row"
                    className="bg-card sticky start-0 z-10 px-3 py-2.5 ps-5 text-start font-normal sm:ps-3"
                  >
                    {c.cell(row)}
                  </th>
                ) : (
                  <td
                    key={c.key}
                    className={cn("px-3 py-2.5 whitespace-nowrap", c.numeric && "numeric text-end")}
                  >
                    {c.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot className="border-t-burgundy/40 border-t font-semibold">
            <tr>
              {footer.map((f, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-3 py-2.5 whitespace-nowrap",
                    i === 0
                      ? "bg-card sticky start-0 z-10 ps-5 text-start sm:ps-3"
                      : "numeric text-end",
                  )}
                >
                  {f}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** KPI tile (stat tile, no chart). */
export function Kpi({
  label,
  value,
  hint,
  tone,
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "loss";
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-3.5 sm:p-4",
        tone === "brand" && "bg-burgundy border-burgundy text-cream",
      )}
      data-testid={testId}
    >
      <p
        className={cn(
          "text-[0.7rem] font-medium tracking-wide uppercase",
          tone === "brand" ? "text-pink" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "numeric mt-1 text-lg font-semibold sm:text-2xl",
          tone === "loss" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-xs",
            tone === "brand" ? "text-cream/80" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function ExportButtons({ href }: { href: string }) {
  const sep = href.includes("?") ? "&" : "?";
  return (
    <>
      <a
        href={`${href}${sep}format=xlsx`}
        download
        className={buttonVariants({ variant: "outline" })}
        data-testid="export-xlsx"
      >
        <FileSpreadsheet /> Excel
      </a>
      <a
        href={`${href}${sep}format=csv`}
        download
        className={buttonVariants({ variant: "outline" })}
        data-testid="export-csv"
      >
        <Download /> CSV
      </a>
    </>
  );
}

/** Horizontal, scrollable tab strip of links (day tabs). */
export function LinkTabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: ReactNode; current: boolean; key: string }[];
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b">
        {items.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.current ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors sm:px-4",
                t.current
                  ? "border-burgundy text-burgundy font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
