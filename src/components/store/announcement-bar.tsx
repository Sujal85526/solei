import Link from "next/link";
import { listLiveBanners } from "@/modules/promotions/queries";

/**
 * The announcement bar: one short line above the header (Admin → Promotions → Banners). Several
 * live messages sit side by side on wide screens; phones show the first one.
 */
export async function AnnouncementBar() {
  const items = (await listLiveBanners()).filter((b) => b.placement === "announcement");
  if (!items.length) return null;
  return (
    <div className="bg-pink text-burgundy relative z-10 text-center text-[0.68rem] tracking-[0.14em]">
      <ul className="mx-auto flex max-w-[96rem] items-center justify-center gap-10 px-4 py-2">
        {items.map((b, i) => (
          <li key={b.id} className={i > 0 ? "hidden lg:block" : undefined}>
            {b.body}
            {b.linkUrl ? (
              <Link href={b.linkUrl} className="ms-2 underline underline-offset-4">
                {b.linkLabel || "Shop now"}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
