import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { BannerForm } from "@/components/admin/promotions/banner-form";
import { requirePagePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New banner" };

export default async function NewBannerPage({
  searchParams,
}: PageProps<"/admin/promotions/banners/new">) {
  await requirePagePermission("coupons.manage");
  const { placement } = await searchParams;
  return (
    <>
      <PageHeader
        title="New banner"
        description="Choose where it shows, write the message and add a link if you like."
      />
      <div className="max-w-3xl">
        <BannerForm placement={placement === "homepage" ? "homepage" : "announcement"} />
      </div>
    </>
  );
}
