"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import * as banners from "./service";

/** Admin list + the storefront hero (cached under the banners tag) show the change. */
function refresh() {
  updateTag(CONTENT_TAGS.banners);
  revalidatePath("/admin/settings/banners");
}

export async function createBannerAction(input: unknown): Promise<ActionResult> {
  try {
    await banners.createBanner(input);
    refresh();
    return ok(undefined, "Banner added.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateBannerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await banners.updateBanner(Object.fromEntries(fd.entries()));
    refresh();
    return ok(undefined, "Banner saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function replaceBannerImageAction(input: unknown): Promise<ActionResult> {
  try {
    await banners.replaceBannerImage(input);
    refresh();
    return ok(undefined, "Picture replaced.");
  } catch (e) {
    return fail(e);
  }
}

export async function moveBannerAction(id: string, dir: -1 | 1): Promise<ActionResult> {
  try {
    await banners.moveBanner(id, dir);
    refresh();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  try {
    await banners.deleteBanner(id);
    refresh();
    return ok(undefined, "Banner deleted.");
  } catch (e) {
    return fail(e);
  }
}
