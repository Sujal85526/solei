import Image from "next/image";
import Link from "next/link";
import { listLiveBanners } from "@/modules/promotions/queries";

/**
 * Homepage promotion banners (Admin → Promotions → Banners): cards under the hero, each with an
 * optional photo, title, message and link. Nothing is shown when none is live.
 */
export async function PromoBanners() {
  const items = (await listLiveBanners()).filter((b) => b.placement === "homepage");
  if (!items.length) return null;
  return (
    <section aria-label="Promotions" className="on-blush px-6 py-10 sm:px-10 lg:px-14">
      <ul className="mx-auto grid max-w-[96rem] gap-6 md:grid-cols-2">
        {items.map((b) => {
          const body = (
            <>
              {b.imageUrl ? (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={b.imageUrl}
                    alt={b.title ?? ""}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 p-6">
                {b.title ? (
                  <h2 className="font-display text-primary text-2xl leading-tight">{b.title}</h2>
                ) : null}
                <p className="text-primary/80 text-sm">{b.body}</p>
                {b.linkUrl ? (
                  <span className="eyebrow text-primary mt-2 text-[0.62rem] underline underline-offset-4">
                    {b.linkLabel || "Discover"}
                  </span>
                ) : null}
              </div>
            </>
          );
          return (
            <li key={b.id} className="border-primary/15 group border bg-white/40">
              {b.linkUrl ? (
                <Link href={b.linkUrl} className="block h-full">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
