"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import * as catalog from "./service";

const entries = (fd: FormData) => {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) out[k] = v;
  return out;
};

function refreshCatalog() {
  updateTag(CONTENT_TAGS.catalog);
  revalidatePath("/admin/products", "layout");
  revalidatePath("/admin/inventory", "layout");
}

export async function saveCategoryAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await catalog.saveCategory(entries(fd));
    refreshCatalog();
    return ok(res, "Category saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveDestinationAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await catalog.saveDestination(entries(fd));
    refreshCatalog();
    return ok(res, "Destination saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveProductAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const res = await catalog.saveProduct({
      ...entries(fd),
      notesTop: fd.get("notesTop") ?? "",
      notesHeart: fd.get("notesHeart") ?? "",
      notesBase: fd.get("notesBase") ?? "",
    });
    refreshCatalog();
    return ok(res, "Product saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function setProductActiveAction(
  productId: string,
  active: boolean,
): Promise<ActionResult> {
  try {
    await catalog.setProductActive(productId, active);
    refreshCatalog();
    return ok(undefined, active ? "Product is live." : "Product hidden from the shop.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveVariantAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const res = await catalog.saveVariant(entries(fd));
    refreshCatalog();
    return ok(res, "Variant saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVariantAction(variantId: string): Promise<ActionResult> {
  try {
    await catalog.deleteVariant(variantId);
    refreshCatalog();
    return ok(undefined, "Variant deleted.");
  } catch (e) {
    return fail(e);
  }
}

export async function addProductImageAction(input: {
  productId: string;
  storagePath: string;
  alt: string;
}): Promise<ActionResult> {
  try {
    await catalog.addProductImage(input);
    refreshCatalog();
    return ok(undefined, "Image added.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateImageAltAction(imageId: string, alt: string): Promise<ActionResult> {
  try {
    await catalog.updateImageAlt(imageId, alt);
    refreshCatalog();
    return ok(undefined, "Saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function reorderImagesAction(productId: string, ids: string[]): Promise<ActionResult> {
  try {
    await catalog.reorderImages(productId, ids);
    refreshCatalog();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteImageAction(imageId: string): Promise<ActionResult> {
  try {
    await catalog.deleteImage(imageId);
    refreshCatalog();
    return ok(undefined, "Image removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveOptionGroupAction(input: unknown): Promise<ActionResult<string>> {
  try {
    const id = await catalog.saveOptionGroup(input);
    refreshCatalog();
    return ok(id, "Options saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOptionGroupAction(groupId: string): Promise<ActionResult> {
  try {
    await catalog.deleteOptionGroup(groupId);
    refreshCatalog();
    return ok(undefined, "Choice removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function setMinOrderQtyAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await catalog.setMinOrderQty(String(fd.get("productId")), Number(fd.get("minOrderQty")));
    refreshCatalog();
    return ok(undefined, "Minimum saved.");
  } catch (e) {
    return fail(e);
  }
}
