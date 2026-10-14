import { Check, Minus } from "lucide-react";
import { eventsCopy as c } from "@/content/events";
import { formatAED } from "@/lib/money";
import type { BookingConfig } from "@/modules/bookings/types";

/** Side-by-side comparison: every inclusion across packages, ticked where included. */
export function PackageCompare({ packages }: { packages: BookingConfig["packages"] }) {
  const rows = [...new Set(packages.flatMap((p) => p.inclusions))];
  return (
    <div className="border-pink/15 overflow-x-auto border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{c.packages.compare}</caption>
        <thead>
          <tr className="border-pink/15 border-b">
            <th scope="col" className="w-2/5 p-4 text-start font-normal">
              <span className="sr-only">Inclusion</span>
            </th>
            {packages.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="font-display text-pink p-4 text-start text-xl font-normal"
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-pink/10 border-b">
            <th scope="row" className="text-pearl-muted p-4 text-start font-normal">
              {c.packages.price}
            </th>
            {packages.map((p) => (
              <td key={p.id} className="numeric text-pearl p-4">
                {formatAED(p.basePriceFils)}
              </td>
            ))}
          </tr>
          {rows.map((row) => (
            <tr key={row} className="border-pink/10 border-b last:border-0">
              <th scope="row" className="text-pearl/85 p-4 text-start font-normal">
                {row}
              </th>
              {packages.map((p) => (
                <td key={p.id} className="p-4">
                  {p.inclusions.includes(row) ? (
                    <Check className="text-pink size-4" aria-label={c.packages.included} />
                  ) : (
                    <Minus
                      className="text-pearl-muted/50 size-4"
                      aria-label={c.packages.notIncluded}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
