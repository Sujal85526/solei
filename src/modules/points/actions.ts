"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import {
  adjustPoints,
  runBirthdaysNow,
  saveRewardsSettings,
  saveTiers,
  setCustomerBirthday,
  setMyBirthday,
} from "./service";
import { deleteReward, saveReward, setRewardActive } from "./rewards";

export async function saveRewardsSettingsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveRewardsSettings(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/loyalty", "layout");
    return ok(undefined, "Points settings saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveTiersAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const names = fd.getAll("name");
  const rows = names.map((name, i) => ({
    name,
    minSpend: fd.getAll("minSpend")[i],
    multiplier: fd.getAll("multiplier")[i],
    perks: fd.getAll("perks")[i],
  }));
  try {
    await saveTiers(rows);
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/loyalty", "layout");
    return ok(undefined, "Tiers saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function adjustPointsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const balance = await adjustPoints(Object.fromEntries(fd.entries()));
    revalidatePath(`/admin/customers/${fd.get("customerId")}`);
    return ok(undefined, `Balance is now ${balance.toLocaleString("en-GB")} points.`);
  } catch (e) {
    return fail(e);
  }
}

export async function setCustomerBirthdayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const id = String(fd.get("customerId") ?? "");
  try {
    await setCustomerBirthday(id, Object.fromEntries(fd.entries()));
    revalidatePath(`/admin/customers/${id}`);
    return ok(undefined, "Birthday saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function setMyBirthdayAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await setMyBirthday(Object.fromEntries(fd.entries()));
    revalidatePath("/account");
    return ok(undefined, "Birthday saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function runBirthdaysAction(): Promise<ActionResult> {
  try {
    const r = await runBirthdaysNow();
    revalidatePath("/admin/loyalty/points");
    return ok(
      undefined,
      r.given
        ? `${r.given} birthday gift${r.given === 1 ? "" : "s"} sent.`
        : "No birthdays to celebrate today.",
    );
  } catch (e) {
    return fail(e);
  }
}

// ── Points rewards catalogue ─────────────────────────────────────────────────────────────────

const refreshRewards = () => revalidatePath("/admin/loyalty", "layout");

export async function saveRewardAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const id = await saveReward(Object.fromEntries(fd.entries()));
    refreshRewards();
    return ok({ id }, "Reward saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRewardAction(id: string): Promise<ActionResult> {
  try {
    await deleteReward(id);
    refreshRewards();
    return ok(undefined, "Reward removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function setRewardActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await setRewardActive(id, active);
    refreshRewards();
    return ok(undefined, active ? "Reward is on." : "Reward is off.");
  } catch (e) {
    return fail(e);
  }
}
