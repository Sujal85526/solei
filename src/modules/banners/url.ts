import { publicEnv } from "@/lib/env";

export const BANNER_BUCKET = "banners";

/** Public address of an object in the banners bucket. */
export function bannerUrl(path: string) {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BANNER_BUCKET}/${path}`;
}
