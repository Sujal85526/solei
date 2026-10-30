import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toBanner } from "./queries";
import {
  MAX_BANNERS,
  createBannerSchema,
  replaceImageSchema,
  updateBannerSchema,
  type Banner,
} from "./schema";
import { BANNER_BUCKET } from "./url";

/*
 * Banner writes go through the caller's session: RLS needs settings.manage and the audit trigger
 * on `hero_banners` records who changed what. The pictures are uploaded by the browser straight to
 * the `banners` bucket (like product photos); these functions record and clean up the paths.
 */

export async function listBanners(): Promise<Banner[]> {
  await assertPermission("settings.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_banners")
    .select("id, desktop_path, mobile_path, alt, link_href, seconds")
    .order("sort")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toBanner);
}

export async function createBanner(input: unknown) {
  await assertPermission("settings.manage");
  const v = createBannerSchema.parse(input);
  if (!v.desktopPath.startsWith(`${v.id}/`) || !v.mobilePath.startsWith(`${v.id}/`))
    throw new UserError("Upload doesn't match this banner.");
  const supabase = await createClient();
  const { data: last, count } = await supabase
    .from("hero_banners")
    .select("sort", { count: "exact" })
    .order("sort", { ascending: false })
    .limit(1);
  if ((count ?? 0) >= MAX_BANNERS)
    throw new UserError(`You can have up to ${MAX_BANNERS} banners. Delete one first.`);
  const { error } = await supabase.from("hero_banners").insert({
    id: v.id,
    sort: (last?.[0]?.sort ?? -1) + 1,
    desktop_path: v.desktopPath,
    mobile_path: v.mobilePath,
    alt: v.alt,
    link_href: v.linkHref,
    seconds: v.seconds,
  });
  if (error) throw new Error(error.message);
}

export async function updateBanner(input: unknown) {
  await assertPermission("settings.manage");
  const v = updateBannerSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_banners")
    .update({ alt: v.alt, link_href: v.linkHref, seconds: v.seconds })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new UserError("Banner not found.");
}

/** Swap one picture (desktop or phone) for a newly uploaded one and remove the old file. */
export async function replaceBannerImage(input: unknown) {
  await assertPermission("settings.manage");
  const v = replaceImageSchema.parse(input);
  if (!v.path.startsWith(`${v.id}/${v.kind}-`))
    throw new UserError("Upload doesn't match this banner.");
  const supabase = await createClient();
  const column = v.kind === "desktop" ? "desktop_path" : "mobile_path";
  const { data: before } = await supabase
    .from("hero_banners")
    .select("desktop_path, mobile_path")
    .eq("id", v.id)
    .maybeSingle();
  if (!before) throw new UserError("Banner not found.");
  const { error } = await supabase
    .from("hero_banners")
    .update(v.kind === "desktop" ? { desktop_path: v.path } : { mobile_path: v.path })
    .eq("id", v.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BANNER_BUCKET).remove([before[column]]);
}

/** Move a banner one place earlier (-1) or later (+1) in the rotation. */
export async function moveBanner(id: string, dir: -1 | 1) {
  await assertPermission("settings.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hero_banners")
    .select("id")
    .order("sort")
    .order("created_at");
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.id);
  const from = ids.indexOf(id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(
    ids.map((bannerId, sort) => supabase.from("hero_banners").update({ sort }).eq("id", bannerId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteBanner(id: string) {
  await assertPermission("settings.manage");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("hero_banners")
    .select("desktop_path, mobile_path")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new UserError("Banner not found.");
  const { error } = await supabase.from("hero_banners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BANNER_BUCKET).remove([row.desktop_path, row.mobile_path]);
}
