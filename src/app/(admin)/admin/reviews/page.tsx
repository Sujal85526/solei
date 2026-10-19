import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewModeration } from "@/components/admin/reviews/review-moderation";
import { Stars } from "@/components/store/reviews/stars";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { listReviewsForAdmin } from "@/modules/reviews/queries";
import type { ReviewStatus } from "@/modules/reviews/schema";

export const metadata: Metadata = { title: "Reviews" };

const TABS: { status: ReviewStatus; label: string; empty: string }[] = [
  { status: "pending", label: "Waiting", empty: "No reviews waiting for approval." },
  { status: "approved", label: "Approved", empty: "No approved reviews yet." },
  { status: "declined", label: "Declined", empty: "No declined reviews." },
];

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePagePermission("reviews.manage");
  const raw = (await searchParams).status;
  const tab = TABS.find((t) => t.status === raw) ?? TABS[0];
  const { reviews, counts } = await listReviewsForAdmin(tab.status);
  return (
    <>
      <PageHeader
        title="Reviews"
        description="Customer reviews appear on the product page only after you approve them."
      />
      <nav aria-label="Review status" className="mb-6 overflow-x-auto">
        <ul className="flex border-b">
          {TABS.map((t) => (
            <li key={t.status}>
              <Link
                href={`/admin/reviews?status=${t.status}`}
                aria-current={t.status === tab.status ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm transition-colors",
                  t.status === tab.status
                    ? "border-primary text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {t.label}
                <span className="bg-muted numeric rounded-full px-2 py-0.5 text-xs">
                  {counts[t.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {reviews.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">{tab.empty}</p>
      ) : (
        <ul className="flex max-w-4xl flex-col gap-4">
          {reviews.map((rv) => (
            <li key={rv.id} className="bg-card flex flex-col gap-4 rounded-xl border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars rating={rv.rating} size="size-4" />
                    {rv.product ? (
                      <Link
                        href={`/products/${rv.product.slug}`}
                        target="_blank"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {rv.product.name}
                      </Link>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {rv.authorName}
                    {rv.customer ? (
                      <>
                        {" · "}
                        <Link
                          href={`/admin/customers/${rv.customer.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {rv.customer.email ?? "customer"}
                        </Link>
                      </>
                    ) : null}
                    {rv.order ? (
                      <>
                        {" · bought in "}
                        <Link
                          href={`/admin/orders/${rv.order.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {rv.order.number}
                        </Link>
                      </>
                    ) : null}
                    {" · "}
                    {formatBusinessDate(rv.createdAt)}
                  </p>
                </div>
                <ReviewModeration id={rv.id} status={rv.status} />
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{rv.body}</p>
              {rv.photos.length ? (
                <div className="flex flex-wrap gap-3">
                  {rv.photos.map((src) => (
                    <a
                      key={src}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block size-24 overflow-hidden rounded-md border"
                    >
                      <Image
                        src={src}
                        alt="Customer photo"
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
