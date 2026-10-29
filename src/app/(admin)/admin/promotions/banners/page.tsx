import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PromoStateBadge, promoState } from "@/components/admin/promotions/promo-state-badge";
import { PromotionsTabs } from "@/components/admin/promotions/promotions-tabs";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { listBanners } from "@/modules/promotions/queries";
import { PLACEMENT_LABELS, type BannerPlacement } from "@/modules/promotions/schema";

export const metadata: Metadata = { title: "Banners" };

const PLACEMENT_HINTS: Record<BannerPlacement, string> = {
  announcement: "One short line above the site header on every page.",
  homepage: "Cards under the big homepage photo.",
};

export default async function BannersPage() {
  await requirePagePermission("coupons.manage");
  const banners = await listBanners();
  return (
    <>
      <PageHeader
        title="Promotions"
        description="Banners on the website — the announcement bar and homepage cards."
        actions={
          <Link href="/admin/promotions/banners/new" className={buttonVariants()}>
            <Plus className="size-4" /> New banner
          </Link>
        }
      />
      <PromotionsTabs />
      <div className="flex flex-col gap-8">
        {(Object.keys(PLACEMENT_LABELS) as BannerPlacement[]).map((placement) => {
          const list = banners
            .filter((b) => b.placement === placement)
            .sort((a, b) => a.sort - b.sort);
          return (
            <section key={placement} className="flex flex-col gap-3">
              <div>
                <h2 className="font-sans text-base font-medium">{PLACEMENT_LABELS[placement]}</h2>
                <p className="text-muted-foreground text-sm">{PLACEMENT_HINTS[placement]}</p>
              </div>
              {list.length === 0 ? (
                <div className="bg-card rounded-xl border p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nothing here yet.{" "}
                    <Link
                      href={`/admin/promotions/banners/new?placement=${placement}`}
                      className="text-foreground underline underline-offset-4"
                    >
                      Add one
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="bg-card divide-y rounded-xl border">
                  {list.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/admin/promotions/banners/${b.id}`}
                        className="hover:bg-muted/50 flex items-center gap-4 px-5 py-4 transition-colors"
                      >
                        {b.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin preview
                          <img
                            src={b.imageUrl}
                            alt=""
                            className="bg-muted hidden aspect-[16/9] w-20 shrink-0 rounded border object-cover sm:block"
                            loading="lazy"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{b.title || b.body}</span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {[
                              b.title ? b.body : null,
                              b.linkUrl,
                              b.endsOn ? `until ${formatBusinessDate(b.endsOn)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "No link"}
                          </span>
                        </span>
                        <PromoStateBadge state={promoState(b)} />
                        <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
