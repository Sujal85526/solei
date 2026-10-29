import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { BannerActions } from "@/components/admin/promotions/banner-actions";
import { BannerForm } from "@/components/admin/promotions/banner-form";
import { PromoStateBadge, promoState } from "@/components/admin/promotions/promo-state-badge";
import { requirePagePermission } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { listBanners } from "@/modules/promotions/queries";
import { PLACEMENT_LABELS } from "@/modules/promotions/schema";

export const metadata: Metadata = { title: "Banner" };

export default async function BannerPage({ params }: PageProps<"/admin/promotions/banners/[id]">) {
  await requirePagePermission("coupons.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const banner = (await listBanners()).find((b) => b.id === id);
  if (!banner) notFound();
  return (
    <>
      <PageHeader
        title={PLACEMENT_LABELS[banner.placement]}
        description={
          <>
            <Link href="/admin/promotions/banners" className="underline underline-offset-4">
              Banners
            </Link>{" "}
            · {banner.title || banner.body}
          </>
        }
        actions={<BannerActions id={banner.id} active={banner.active} />}
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <BannerForm banner={banner} />
        <aside className="bg-card flex flex-col gap-4 rounded-xl border p-5 text-sm lg:order-last">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <PromoStateBadge state={promoState(banner)} />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Changes show on the website straight away. Hidden banners and banners outside their
            dates stay in this list.
          </p>
        </aside>
      </div>
    </>
  );
}
