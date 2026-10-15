import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountGate } from "@/components/store/account/account-gate";
import { AddressForm, ProfileForm, SignOutLink } from "@/components/store/account/profile-forms";
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
      <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-24">
        <AccountGate />
      </div>
    );
  }
  const { meta, orders, email } = overview;
  const zones = settings.zones.map((z) => ({ emirate: z.emirate, name: z.name }));

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:px-10 sm:py-20">
      <header className="border-border flex flex-wrap items-end justify-between gap-4 border-b pb-8">
        <div>
          <p className="text-muted-foreground text-[0.65rem] tracking-[0.3em] uppercase">
            {c.page.title}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl">
            {c.page.hello(meta.first_name || email.split("@")[0])}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{email}</p>
        </div>
        <SignOutLink />
      </header>

      <div className="grid gap-14 pt-10 lg:grid-cols-12 lg:gap-16">
        <section id="orders" aria-labelledby="orders-title" className="scroll-mt-24 lg:col-span-7">
          <h2 id="orders-title" className="text-2xl">
            {c.page.orders}
          </h2>
          {orders.length ? (
            <ul className="divide-border border-border mt-6 divide-y border-y">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={o.href}
                    className="hover:bg-muted/60 grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-1 py-5 transition-colors sm:grid-cols-[1fr_auto_auto]"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="numeric text-sm font-medium">
                        {c.page.order} {o.number}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatBusinessDate(o.placedAt)} · {c.page.items(o.items)}
                      </span>
                    </span>
                    <span className="text-muted-foreground hidden text-[0.65rem] tracking-[0.2em] uppercase sm:block">
                      {CUSTOMER_ORDER_STATUS[o.status]}
                    </span>
                    <span className="numeric text-end text-sm">
                      {formatAED(o.totalFils)}
                      <span className="text-muted-foreground block text-[0.6rem] tracking-[0.2em] uppercase sm:hidden">
                        {CUSTOMER_ORDER_STATUS[o.status]}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border mt-6 flex flex-col items-start gap-4 border-y py-10">
              <p className="text-muted-foreground text-sm">{c.page.noOrders}</p>
              <Link
                href="/shop"
                className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
              >
                {c.page.shop}
              </Link>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-12 lg:col-span-5">
          <section aria-labelledby="details-title">
            <h2 id="details-title" className="text-2xl">
              {c.page.details}
            </h2>
            <ProfileForm
              initial={{
                firstName: meta.first_name ?? "",
                lastName: meta.last_name ?? "",
                phone: meta.phone ?? "",
              }}
            />
          </section>
          <section aria-labelledby="address-title">
            <h2 id="address-title" className="text-2xl">
              {c.page.address}
            </h2>
            <AddressForm initial={meta.address ?? null} zones={zones} />
          </section>
          <Link
            href="/passport"
            className="text-muted-foreground hover:text-primary self-start text-[0.7rem] tracking-[0.2em] uppercase underline-offset-4 hover:underline"
          >
            {c.page.passport} →
          </Link>
        </div>
      </div>
    </div>
  );
}
