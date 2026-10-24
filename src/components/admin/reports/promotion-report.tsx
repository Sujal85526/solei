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
        <div className="-mx-5 overflow-x-auto sm:mx-0">
          <table className="numeric w-full min-w-[32rem] text-sm">
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
                  <td className="px-5 py-2.5 font-mono sm:ps-0">
                    {canOpen && r.couponId ? (
                      <Link
                        href={`/admin/promotions/${r.couponId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.code}
                      </Link>
                    ) : (
                      r.code
                    )}
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
      )}
    </div>
  );
}
