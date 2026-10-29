import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { BannersManager } from "@/components/admin/settings/banners-manager";
import { requirePagePermission } from "@/lib/auth/session";
import { listBanners } from "@/modules/banners/service";

export const metadata: Metadata = { title: "Homepage banners" };

export default async function BannersSettingsPage() {
  await requirePagePermission("settings.manage");
  const banners = await listBanners();
  return (
    <>
      <PageHeader
        title="Homepage banners"
        description="The big pictures at the top of the homepage. With two or more, they change by themselves after the seconds you set. With none, the standard hero shows. Put any text inside the picture itself."
      />
      <BannersManager banners={banners} />
    </>
  );
}
