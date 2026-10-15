import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountGate } from "@/components/store/account/account-gate";
import { buttonVariants } from "@/components/ui/button";
import { accountCopy as c } from "@/content/account";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { CUSTOMER_ORDER_STATUS, getAccountOverview } from "@/modules/account/queries";

export const metadata: Metadata = { title: c.page.ordersTitle, robots: { index: false } };

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  await connection();
  const overview = await getAccountOverview();
  if (!overview) {
    return (
      <div className="mx-auto max-w-sm py-4">
        <AccountGate />
      </div>
    );
  }
  const { orders } = overview;

  if (!orders.length) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-3xl">{c.page.ordersTitle}</h1>
        <p className="text-muted-foreground text-sm">{c.page.emptyOrders}</p>
        <Link href="/shop" className={buttonVariants({ size: "cta", className: "h-11 px-8" })}>
          {c.page.continueShopping}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl">{c.page.ordersTitle}</h1>
      <ul className="divide-border border-border mt-6 divide-y border-y">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={o.href}
              className="hover:text-primary flex items-center justify-between gap-4 py-4 text-sm transition-colors"
            >
              <span className="flex flex-col gap-0.5">
                <span className="numeric">{o.number}</span>
                <span className="text-muted-foreground text-xs">
                  {formatBusinessDate(o.placedAt)} · {c.page.items(o.items)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="numeric">{formatAED(o.totalFils)}</span>
                <span className="text-muted-foreground text-xs">
                  {CUSTOMER_ORDER_STATUS[o.status]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
