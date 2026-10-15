import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountGate } from "@/components/store/account/account-gate";
import { AccountDetails, SignOutLink } from "@/components/store/account/profile-forms";
import { accountCopy as c } from "@/content/account";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { CUSTOMER_ORDER_STATUS, getAccountOverview } from "@/modules/account/queries";
import { getCartSettings } from "@/modules/storefront/queries";

export const metadata: Metadata = { title: c.page.title, robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="theme-light flex-1">
      <Suspense fallback={<div className="min-h-[60vh]" />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  await connection();
  const [overview, settings] = await Promise.all([getAccountOverview(), getCartSettings()]);
  if (!overview) {
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-14 sm:py-20">
        <AccountGate />
      </div>
    );
  }
  const { meta, orders, email } = overview;
  const zones = settings.zones.map((z) => ({ emirate: z.emirate, name: z.name }));
  const label = "text-muted-foreground font-sans text-[0.6rem] tracking-[0.25em] uppercase";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">{c.page.hello(meta.first_name || email.split("@")[0])}</h1>
          <p className="text-muted-foreground mt-1 text-xs">{email}</p>
        </div>
        <SignOutLink />
      </header>

      <section id="orders" aria-labelledby="orders-title" className="mt-10 scroll-mt-24">
        <h2 id="orders-title" className={label}>
          {c.page.orders}
        </h2>
        {orders.length ? (
          <ul className="divide-border border-border mt-3 divide-y border-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={o.href}
                  className="hover:text-primary flex items-center justify-between gap-4 py-3.5 text-sm transition-colors"
                >
                  <span>
                    <span className="numeric">{o.number}</span>
                    <span className="text-muted-foreground text-xs">
                      {" "}
                      · {formatBusinessDate(o.placedAt)} · {c.page.items(o.items)}
                    </span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="text-muted-foreground hidden text-xs sm:inline">
                      {CUSTOMER_ORDER_STATUS[o.status]}
                    </span>
                    <span className="numeric">{formatAED(o.totalFils)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-border text-muted-foreground mt-3 border-y py-4 text-sm">
            {c.page.noOrders}{" "}
            <Link href="/shop" className="text-primary underline underline-offset-4">
              {c.page.shop}
            </Link>
          </p>
        )}
      </section>

      <div className="mt-6">
        <AccountDetails
          profile={{
            firstName: meta.first_name ?? "",
            lastName: meta.last_name ?? "",
            phone: meta.phone ?? "",
          }}
          address={meta.address ?? null}
          zones={zones}
        />
      </div>

      <Link
        href="/passport"
        className="text-muted-foreground hover:text-primary mt-6 inline-block text-xs underline-offset-4 hover:underline"
      >
        {c.page.passport} →
      </Link>
    </div>
  );
}
