import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { StockRow } from "@/modules/inventory/queries";

type Loc = { id: string; name: string; kind: string };

/**
 * Desktop: variant × location table. Phones: one card per variant with location chips.
 * `values` (financial staff only): stock value per variant in fils, shown as a last column.
 */
export function StockTable({
  rows,
  locations,
  values,
}: {
  rows: StockRow[];
  locations: Loc[];
  values?: Record<string, number>;
}) {
  return (
    <>
      <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-start text-xs">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                Product
              </th>
              {locations.map((l) => (
                <th key={l.id} scope="col" className="px-3 py-3 text-end font-medium">
                  {l.name}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Total
              </th>
              {values ? (
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  Value
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr
                key={r.variantId}
                className={cn("hover:bg-muted/30 relative", !r.active && "opacity-60")}
              >
                <th scope="row" className="px-4 py-3 text-start font-normal">
                  <Link
                    href={`/admin/inventory/${r.variantId}`}
                    className="font-medium after:absolute after:inset-0 hover:underline"
                  >
                    {r.productName}
                  </Link>
                  <span className="text-muted-foreground block font-mono text-xs">
                    {r.sku}
                    {r.variantLabel ? ` · ${r.variantLabel}` : ""}
                  </span>
                </th>
                {locations.map((l) => (
                  <td key={l.id} className="numeric px-3 py-3 text-end">
                    {r.byLocation[l.id] ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
                <td className="numeric px-4 py-3 text-end font-semibold">
                  <span className="inline-flex items-center gap-2">
                    {r.low ? <Badge variant="warning">Low</Badge> : null}
                    {r.total}
                  </span>
                </td>
                {values ? (
                  <td className="numeric text-muted-foreground px-4 py-3 text-end">
                    {formatAED(values[r.variantId] ?? 0)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.variantId}>
            <Link
              href={`/admin/inventory/${r.variantId}`}
              className={cn("bg-card block rounded-xl border p-4", !r.active && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.productName}</p>
                  <p className="text-muted-foreground font-mono text-xs">{r.sku}</p>
                </div>
                <p className="numeric text-2xl font-semibold">
                  {r.total}
                  {r.low ? (
                    <Badge variant="warning" className="ms-2 align-middle">
                      Low
                    </Badge>
                  ) : null}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {locations
                  .filter((l) => r.byLocation[l.id] !== undefined)
                  .map((l) => (
                    <span key={l.id} className="numeric bg-muted rounded-full px-2.5 py-1 text-xs">
                      {l.name}: {r.byLocation[l.id]}
                    </span>
                  ))}
                {values ? (
                  <span className="numeric bg-muted rounded-full px-2.5 py-1 text-xs">
                    Value: {formatAED(values[r.variantId] ?? 0)}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
