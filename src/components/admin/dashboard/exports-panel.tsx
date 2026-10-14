import { Download, FileSpreadsheet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EXPORT_LABELS, type ExportKind } from "@/modules/exports/params";

/**
 * Downloads without JavaScript: one GET form, each button posts to its own export route
 * (`formAction`) with `format`. Orders and payments use the date range; the others ignore it.
 */
export function ExportsPanel({
  kinds,
  from,
  to,
}: {
  kinds: ExportKind[];
  from: string;
  to: string;
}) {
  const dated = kinds.filter((k) => k === "orders" || k === "payments");
  const snapshot = kinds.filter((k) => k === "customers" || k === "stock");
  const buttons = (kind: ExportKind) => (
    <div key={kind} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span className="text-sm font-medium">{EXPORT_LABELS[kind]}</span>
      <span className="flex gap-2">
        <button
          type="submit"
          formAction={`/admin/exports/${kind}`}
          name="format"
          value="xlsx"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          data-testid={`export-${kind}-xlsx`}
        >
          <FileSpreadsheet /> Excel
        </button>
        <button
          type="submit"
          formAction={`/admin/exports/${kind}`}
          name="format"
          value="csv"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          data-testid={`export-${kind}-csv`}
        >
          <Download /> CSV
        </button>
      </span>
    </div>
  );

  return (
    <form method="get" className="flex flex-col gap-4">
      {dated.length ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-from">From</Label>
              <Input id="export-from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="export-to">To</Label>
              <Input id="export-to" name="to" type="date" defaultValue={to} />
            </div>
          </div>
          <div className="divide-y">{dated.map(buttons)}</div>
        </div>
      ) : null}
      {snapshot.length ? (
        <div>
          <p className="text-muted-foreground text-xs">Current snapshot</p>
          <div className="divide-y">{snapshot.map(buttons)}</div>
        </div>
      ) : null}
    </form>
  );
}
