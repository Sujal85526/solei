import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Upload a banner image from the browser to the public `banners` bucket as `<uuid>.<ext>`
 * (Storage RLS: coupons.manage). Returns its public URL and path, or an error in staff words.
 */
export async function uploadBannerImage(
  file: File,
): Promise<{ url: string; path: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > MAX_BYTES) return { error: `${file.name} is over 5 MB.` };
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const bucket = createClient().storage.from("banners");
  const { error } = await bucket.upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { url: bucket.getPublicUrl(path).data.publicUrl, path };
}
