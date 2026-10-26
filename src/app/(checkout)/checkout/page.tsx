import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckoutFlow } from "@/components/store/checkout/checkout-form";
import { t } from "@/content/en";
import { currentAccount } from "@/modules/account/service";
import { policySummary } from "@/modules/help/format";
import { getHelpTopics } from "@/modules/help/queries";
import { getCartSettings } from "@/modules/storefront/queries";

export const metadata: Metadata = { title: t.checkout.title, robots: { index: false } };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Checkout />
    </Suspense>
  );
}

/** Signed-out visitors sign in or create an account first; the delivery form is prefilled after. */
async function Checkout() {
  await connection();
  const [account, settings, topics] = await Promise.all([
    currentAccount(),
    getCartSettings(),
    getHelpTopics().catch(() => []),
  ]);
  const zones = settings.zones.map((z) => ({ emirate: z.emirate, name: z.name }));
  // Returns summary shown by the pay button, from the owner-edited Help returns topic.
  const returnsTopic = topics.find((topic) => topic.slug === "returns");
  const returnsSummary =
    (returnsTopic && policySummary(returnsTopic.body)) ?? t.checkout.policy.returnsFallback;
  return (
    <CheckoutFlow
      zones={zones}
      returnsSummary={returnsSummary}
      account={
        account
          ? {
              email: account.user.email!,
              firstName: account.meta.first_name ?? "",
              lastName: account.meta.last_name ?? "",
              phone: account.meta.phone ?? "",
              address: account.meta.address ?? null,
            }
          : null
      }
    />
  );
}
