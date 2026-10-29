import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { Banner } from "./schema";
import { bannerUrl } from "./url";

/** The homepage banners in order (cached; refreshed when the owner saves). Empty = built-in hero. */
export async function getHeroBanners(): Promise<Banner[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.banners);
  if (process.env.CONTENT_FALLBACK === "1") return [];
  const { data } = await createPublicClient()
    .from("hero_banners")
    .select("id, desktop_path, mobile_path, alt, link_href, seconds")
    .order("sort")
    .order("created_at");
  return (data ?? []).map(toBanner);
}

export function toBanner(row: {
  id: string;
  desktop_path: string;
  mobile_path: string;
  alt: string;
  link_href: string | null;
  seconds: number;
}): Banner {
  return {
    id: row.id,
    desktopUrl: bannerUrl(row.desktop_path),
    mobileUrl: bannerUrl(row.mobile_path),
    alt: row.alt,
    href: row.link_href,
    seconds: row.seconds,
  };
}
