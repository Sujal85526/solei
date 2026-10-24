import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAED } from "@/lib/money";
import type { PromotionReportRow } from "@/modules/coupons/queries";

/**
 * Reports → Promotions: per code, the paid orders that used it in the chosen days, the discount
 * given (goods + waived delivery) and those orders' sales. The date form is a plain GET form.
 */
export function PromotionReport({
  from,
  to,
  rows,
  canOpen,
}: {
  from: string;
  to: string;
  rows: PromotionReportRow[];
  /** Link codes to their promotion page (needs coupons.manage). */
  canOpen: boolean;
}) {
  const total = rows.reduce(
    (t, r) => ({
      orders: t.orders + r.orders,
      given: t.given + r.discountFils + r.deliveryDiscountFils,
      sales: t.sales + r.salesFils,
    }),
    { orders: 0, given: 0, sales: 0 },
  );
  return (
    <div className="flex flex-col gap-5">
      <form className="flex flex-wrap items-end gap-3" aria-label="Promotions report dates">
        <label className="flex flex-col gap-1.5 text-sm">
          From
          <Input type="date" name="from" defaultValue={from} className="h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          To
          <Input type="date" name="to" defaultValue={to} className="h-10 w-40" />
        </label>
        <Button type="submit" variant="outline" className="h-10">
          Show
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No paid orders used a code in these days.</p>
      ) : (
        <>
          {/* Phones: one row per code. */}
          <ul className="numeric divide-y border-y text-sm sm:hidden">
            {rows.map((r) => (
              <li key={r.code} className="flex flex-col gap-1 py-3">
                <span className="flex items-baseline justify-between gap-3">
                  <CodeLink row={r} canOpen={canOpen} />
                  <span>{formatAED(r.salesFils)}</span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {r.orders} order{r.orders === 1 ? "" : "s"} ·{" "}
                  {[
                    r.discountFils ? `${formatAED(r.discountFils)} off` : null,
                    r.deliveryDiscountFils
                      ? `${formatAED(r.deliveryDiscountFils)} delivery waived`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "nothing given"}
                </span>
              </li>
            ))}
            <li className="flex justify-between py-3 font-medium">
              <span>
                {total.orders} order{total.orders === 1 ? "" : "s"} · {formatAED(total.given)} given
              </span>
              <span>{formatAED(total.sales)}</span>
            </li>
          </ul>
          <div className="hidden sm:block">
            <table className="numeric w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-xs tracking-wide uppercase">
                  <th className="px-5 py-2 text-start font-medium sm:ps-0">Code</th>
                  <th className="px-3 py-2 text-end font-medium">Orders</th>
                  <th className="px-3 py-2 text-end font-medium">Discount</th>
                  <th className="px-3 py-2 text-end font-medium">Delivery waived</th>
                  <th className="px-5 py-2 text-end font-medium sm:pe-0">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td className="px-5 py-2.5 sm:ps-0">
                      <CodeLink row={r} canOpen={canOpen} />
                    </td>
                    <td className="px-3 py-2.5 text-end">{r.orders}</td>
                    <td className="px-3 py-2.5 text-end">{formatAED(r.discountFils)}</td>
                    <td className="px-3 py-2.5 text-end">{formatAED(r.deliveryDiscountFils)}</td>
                    <td className="px-5 py-2.5 text-end sm:pe-0">{formatAED(r.salesFils)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="px-5 py-2.5 sm:ps-0">Total</td>
                  <td className="px-3 py-2.5 text-end">{total.orders}</td>
                  <td className="px-3 py-2.5 text-end" colSpan={2}>
                    {formatAED(total.given)} given
                  </td>
                  <td className="px-5 py-2.5 text-end sm:pe-0">{formatAED(total.sales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CodeLink({ row, canOpen }: { row: PromotionReportRow; canOpen: boolean }) {
  return canOpen && row.couponId ? (
    <Link
      href={`/admin/promotions/${row.couponId}`}
      className="font-mono underline-offset-4 hover:underline"
    >
      {row.code}
    </Link>
  ) : (
    <span className="font-mono">{row.code}</span>
  );
}
