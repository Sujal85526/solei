"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { deleteCoupon, saveCoupon, setCouponActive } from "./service";

export async function saveCouponAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await saveCoupon({
      ...Object.fromEntries(fd.entries()),
      productIds: fd.getAll("productIds"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/coupons");
  if (!fd.get("id")) redirect(`/admin/coupons/${id}?created=1`);
  revalidatePath(`/admin/coupons/${id}`);
  return ok(undefined, "Saved.");
}

export async function setCouponActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setCouponActive(id, active);
    revalidatePath("/admin/coupons");
    revalidatePath(`/admin/coupons/${id}`);
    return ok(undefined, active ? "Coupon is live again." : "Coupon paused.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  try {
    await deleteCoupon(id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}
