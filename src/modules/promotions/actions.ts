"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import { PROMOTIONS_TAG } from "./queries";
import {
  deleteBanner,
  deleteOffer,
  saveBanner,
  saveOffer,
  setBannerActive,
  setOfferActive,
} from "./service";

const OFFERS = "/admin/promotions/offers";
const BANNERS = "/admin/promotions/banners";

/** Shop prices and banners read from cache: expire them so the change shows straight away. */
function refreshStorefront() {
  updateTag(PROMOTIONS_TAG);
  updateTag(CONTENT_TAGS.catalog);
}

function refreshOffers(id?: string) {
  refreshStorefront();
  revalidatePath(OFFERS);
  if (id) revalidatePath(`${OFFERS}/${id}`);
}

function refreshBanners(id?: string) {
  refreshStorefront();
  revalidatePath(BANNERS);
  if (id) revalidatePath(`${BANNERS}/${id}`);
}

export async function saveOfferAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await saveOffer({
      ...Object.fromEntries(fd.entries()),
      productIds: fd.getAll("productIds"),
      categoryIds: fd.getAll("categoryIds"),
      channels: fd.getAll("channels"),
    });
  } catch (e) {
    return fail(e);
  }
  refreshOffers(id);
  if (!fd.get("id")) redirect(`${OFFERS}/${id}?created=1`);
  return ok(undefined, "Saved.");
}

export async function setOfferActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setOfferActive(id, active);
    refreshOffers(id);
    return ok(undefined, active ? "Offer is live again." : "Offer paused.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOfferAction(id: string): Promise<ActionResult> {
  try {
    await deleteOffer(id);
  } catch (e) {
    return fail(e);
  }
  refreshOffers();
  redirect(OFFERS);
}

export async function saveBannerAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await saveBanner(Object.fromEntries(fd.entries()));
  } catch (e) {
    return fail(e);
  }
  refreshBanners(id);
  if (!fd.get("id")) redirect(`${BANNERS}/${id}?created=1`);
  return ok(undefined, "Saved.");
}

export async function setBannerActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setBannerActive(id, active);
    refreshBanners(id);
    return ok(undefined, active ? "Banner is showing again." : "Banner hidden.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  try {
    await deleteBanner(id);
  } catch (e) {
    return fail(e);
  }
  refreshBanners();
  redirect(BANNERS);
}
