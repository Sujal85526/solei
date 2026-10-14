import type { Metadata } from "next";
import { Container } from "@/components/brand";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { PageIntro } from "@/components/store/shop/page-intro";
import { t } from "@/content/en";
import { getCartSettings } from "@/modules/storefront/queries";

export const metadata: Metadata = { title: t.checkout.title, robots: { index: false } };

export default async function CheckoutPage() {
  const settings = await getCartSettings();
  return (
    <>
      <PageIntro
        eyebrow={t.checkout.eyebrow}
        title={
          <>
            Check<span className="italic">out.</span>
          </>
        }
        className="pb-8 sm:pb-12"
      />
      <Container size="wide" className="pb-24 sm:pb-32">
        <CheckoutForm zones={settings.zones} />
      </Container>
    </>
  );
}
