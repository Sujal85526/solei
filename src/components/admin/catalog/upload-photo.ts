import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Upload one photo from the browser to the public `products` bucket under `folder` (Storage RLS:
 * catalog.manage). Returns its public URL and path, or an error in staff words.
 */
export async function uploadCatalogPhoto(
  file: File,
  folder: string,
): Promise<{ url: string; path: string } | { error: string }> {
  if (!TYPES.includes(file.type)) return { error: `${file.name}: use JPG, PNG, WebP or AVIF.` };
  if (file.size > MAX_BYTES) return { error: `${file.name} is over 5 MB.` };
  const ext =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const bucket = createClient().storage.from("products");
  const { error } = await bucket.upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) return { error: `Upload failed: ${error.message}` };
  return { url: bucket.getPublicUrl(path).data.publicUrl, path };
}
