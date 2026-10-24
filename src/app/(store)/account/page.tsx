import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountGate } from "@/components/store/account/account-gate";
import { CartRemindersToggle } from "@/components/store/account/cart-reminders-toggle";
import { AccountDetails } from "@/components/store/account/profile-forms";
import { accountCopy as c } from "@/content/account";
import { currentAccount } from "@/modules/account/service";
import { myCartRemindersOff } from "@/modules/carts/queries";
import { getCartSettings } from "@/modules/storefront/queries";

export const metadata: Metadata = { title: c.page.title, robots: { index: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  await connection();
  const [account, settings] = await Promise.all([currentAccount(), getCartSettings()]);
  if (!account) {
    return (
      <div className="mx-auto max-w-sm py-4">
        <AccountGate />
      </div>
    );
  }
  const { meta, user } = account;
  const remindersOff = await myCartRemindersOff(user.id);
  return (
    <>
      <h1 className="text-3xl">{c.page.hello(meta.first_name || user.email!.split("@")[0])}</h1>
      <div className="mt-6">
        <AccountDetails
          email={user.email!}
          profile={{
            firstName: meta.first_name ?? "",
            lastName: meta.last_name ?? "",
            phone: meta.phone ?? "",
          }}
          address={meta.address ?? null}
          zones={settings.zones.map((z) => ({ emirate: z.emirate, name: z.name }))}
        />
        <CartRemindersToggle on={!remindersOff} />
      </div>
    </>
  );
}
