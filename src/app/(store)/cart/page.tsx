import type { Metadata } from "next";
import { Container } from "@/components/brand";
import { CartView } from "@/components/store/cart/cart-view";
import { PageIntro } from "@/components/store/shop/page-intro";
import { t } from "@/content/en";
import { getCartSettings } from "@/modules/storefront/queries";

export const metadata: Metadata = {
  title: t.cart.title,
  description: t.cart.metaDescription,
  robots: { index: false },
};

export default async function CartPage() {
  const settings = await getCartSettings();
  return (
    <>
      <PageIntro
        eyebrow={t.cart.eyebrow}
        title={
          <>
            Your <span className="italic">cart.</span>
          </>
        }
        className="pb-8 sm:pb-12"
      />
      <Container size="wide" className="pb-24 sm:pb-32">
        <CartView
          zones={settings.zones}
          freeDeliveryThresholdFils={settings.freeDeliveryThresholdFils}
        />
      </Container>
    </>
  );
}
