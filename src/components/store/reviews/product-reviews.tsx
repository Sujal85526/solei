import Image from "next/image";
import { ReviewComposer } from "@/components/store/reviews/review-composer";
import { Stars } from "@/components/store/reviews/stars";
import { t } from "@/content/en";
import { formatBusinessDate } from "@/lib/dates";
import { getProductReviews } from "@/modules/reviews/queries";

const r = t.product.reviews;

/**
 * Product page reviews: star average and "Write a review" beside the approved reviews (newest
 * first, with photos). The list is cached under the `reviews` tag; approving one refreshes it.
 */
export async function ProductReviews({ productId }: { productId: string }) {
  const { count, average, reviews } = await getProductReviews(productId);
  return (
    <section
      aria-labelledby="reviews-title"
      className="on-blush border-primary/15 border-t py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-[96rem] gap-12 px-6 sm:px-10 lg:grid-cols-12 lg:px-14">
        <div className="flex flex-col items-start gap-5 lg:col-span-4">
          <p className="eyebrow text-primary text-[0.62rem]">{r.eyebrow}</p>
          <h2 id="reviews-title" className="text-4xl leading-tight sm:text-5xl">
            {r.title}
          </h2>
          {count ? (
            <p className="flex items-center gap-3">
              <span className="font-display numeric text-3xl">{average.toFixed(1)}</span>
              <Stars rating={average} size="size-4" />
              <span className="text-foreground/70 text-sm">{r.count(count)}</span>
            </p>
          ) : (
            <p className="text-foreground/70 text-sm">{r.none}</p>
          )}
          <div className="mt-2 w-full">
            <ReviewComposer productId={productId} />
          </div>
        </div>
        {count ? (
          <ul className="divide-primary/15 flex flex-col divide-y lg:col-span-7 lg:col-start-6">
            {reviews.map((rv) => (
              <li key={rv.id} className="flex flex-col gap-3 py-7 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Stars rating={rv.rating} />
                  <span className="text-sm font-medium">{rv.authorName}</span>
                  <span className="text-foreground/55 text-xs">
                    {formatBusinessDate(rv.createdAt, { month: "long", year: "numeric" })}
                  </span>
                </div>
                <p className="text-foreground/85 max-w-2xl text-[0.95rem] leading-relaxed whitespace-pre-line">
                  {rv.body}
                </p>
                {rv.photos.length ? (
                  <div className="flex flex-wrap gap-3">
                    {rv.photos.map((src) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="relative block size-24 overflow-hidden rounded-sm"
                      >
                        <Image src={src} alt="" fill sizes="96px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
