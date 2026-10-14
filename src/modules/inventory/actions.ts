"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import * as inventory from "./service";

/** Availability on the storefront is cached under this tag. */
const STOCK_TAG = "stock";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

function refresh() {
  updateTag(STOCK_TAG);
  revalidatePath("/admin/inventory", "layout");
  revalidatePath("/admin/products", "layout");
}

export async function receiveStockAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await inventory.receiveStock(entries(fd));
    refresh();
    return ok(undefined, "Stock received.");
  } catch (e) {
    return fail(e);
  }
}

export async function adjustStockAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await inventory.adjustStock(entries(fd));
    refresh();
    return ok(undefined, "Stock adjusted.");
  } catch (e) {
    return fail(e);
  }
}

export async function transferStockAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await inventory.transferStock(entries(fd));
    refresh();
    return ok(undefined, "Stock transferred.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveLocationAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await inventory.saveLocation(entries(fd));
    refresh();
    return ok(undefined, "Location saved.");
  } catch (e) {
    return fail(e);
  }
}
