import Link from "next/link";
import { formatAED } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import type { OrderListRow } from "@/modules/orders/queries";
import { ChannelBadge, OrderStatusBadge, PaymentStatusBadge } from "./order-badges";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const when = (iso: string | null) => (iso ? timeFmt.format(new Date(iso)) : "—");

/** Desktop: table. Phones: one tappable card per order. */
export function OrdersList({ rows }: { rows: OrderListRow[] }) {
  if (!rows.length)
    return (
      <p className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        No orders match these filters.
      </p>
    );
  return (
    <>
      <div className="bg-card hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-xs">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                Order
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium">
                Channel
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium">
                Payment
              </th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-muted/30">
                <th scope="row" className="px-4 py-3 text-start font-normal">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                    {o.number}
                  </Link>
                  <span className="numeric text-muted-foreground block text-xs">
                    {when(o.placed_at)} · {o.item_count} {o.item_count === 1 ? "item" : "items"}
                  </span>
                </th>
                <td className="px-3 py-3">
                  <span className="block">{o.contact_name || "Walk-in"}</span>
                  <span className="numeric text-muted-foreground block text-xs">
                    {o.contact_phone ? formatPhone(o.contact_phone) : ""}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {o.channel ? <ChannelBadge channel={o.channel} /> : null}
                  {o.event_name ? (
                    <span className="text-muted-foreground mt-1 block text-xs">{o.event_name}</span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  {o.status ? <OrderStatusBadge status={o.status} /> : null}
                </td>
                <td className="px-3 py-3">
                  <PaymentStatusBadge status={o.payment_status} />
                </td>
                <td className="numeric px-4 py-3 text-end">
                  <span className="font-semibold">{formatAED(o.total_fils ?? 0)}</span>
                  {(o.outstanding_fils ?? 0) > 0 && o.status !== "cancelled" ? (
                    <span className="block text-xs text-[#8A5108]">
                      {formatAED(o.outstanding_fils ?? 0)} due
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/orders/${o.id}`}
              className="bg-card active:bg-muted/40 block rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{o.number}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {o.contact_name || "Walk-in"}
                    {o.event_name ? ` · ${o.event_name}` : ""}
                  </p>
                </div>
                <div className="text-end">
                  <p className="numeric text-lg font-semibold">{formatAED(o.total_fils ?? 0)}</p>
                  {(o.outstanding_fils ?? 0) > 0 && o.status !== "cancelled" ? (
                    <p className="numeric text-xs text-[#8A5108]">
                      {formatAED(o.outstanding_fils ?? 0)} due
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {o.status ? <OrderStatusBadge status={o.status} /> : null}
                <PaymentStatusBadge status={o.payment_status} />
                {o.channel ? <ChannelBadge channel={o.channel} /> : null}
                <span className="numeric text-muted-foreground ms-auto text-xs">
                  {when(o.placed_at)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
