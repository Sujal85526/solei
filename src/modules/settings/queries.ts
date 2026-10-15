import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { ContactDetails } from "./schema";

/** Public contact details for the Contact page and footer (cached; refreshed on save). */
export async function getContactDetails(): Promise<ContactDetails> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.settings);
  if (process.env.CONTENT_FALLBACK === "1") {
    return {
      email: null,
      whatsapp: null,
      instagramHandle: "@solei.ad",
      instagramUrl: "https://www.instagram.com/solei.ad/",
    };
  }
  const { data } = await createPublicClient()
    .from("settings")
    .select("contact_email, whatsapp_number, instagram_handle, instagram_url")
    .eq("id", 1)
    .maybeSingle();
  return {
    email: data?.contact_email?.trim() || null,
    whatsapp: data?.whatsapp_number?.trim() || null,
    instagramHandle: data?.instagram_handle?.trim() || null,
    instagramUrl: data?.instagram_url?.trim() || null,
  };
}
