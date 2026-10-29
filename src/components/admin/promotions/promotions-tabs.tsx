import { SubNav } from "@/components/admin/sub-nav";

/** Codes · Offers · Banners, at the top of the three Promotions pages. */
export function PromotionsTabs() {
  return (
    <SubNav
      items={[
        { href: "/admin/promotions", label: "Codes" },
        { href: "/admin/promotions/offers", label: "Offers" },
        { href: "/admin/promotions/banners", label: "Banners" },
      ]}
    />
  );
}
