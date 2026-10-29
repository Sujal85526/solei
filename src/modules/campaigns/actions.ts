"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { previewSegment, type SegmentPreview } from "./queries";
import { segmentFormSchema } from "./schema";
import {
  deleteCampaign,
  deleteSegment,
  saveCampaign,
  saveSegment,
  sendCampaign,
  sendTestCampaign,
  unsubscribeFromLink,
} from "./service";

const formValues = (fd: FormData) => ({
  ...Object.fromEntries(fd.entries()),
  destinationIds: fd.getAll("destinationIds"),
  emirates: fd.getAll("emirates"),
  labels: fd.getAll("labels"),
});

/** Live count while the segment form is edited (invalid input → no preview). */
export async function previewSegmentAction(fd: FormData): Promise<SegmentPreview | null> {
  const parsed = segmentFormSchema.safeParse({ ...formValues(fd), name: "preview" });
  if (!parsed.success) return null;
  return previewSegment(parsed.data.rules);
}

export async function saveSegmentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await saveSegment(formValues(fd));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/campaigns", "layout");
  if (!fd.get("id")) redirect(`/admin/campaigns/segments/${id}`);
  return ok(undefined, "Segment saved.");
}

export async function deleteSegmentAction(id: string): Promise<ActionResult> {
  try {
    await deleteSegment(id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/campaigns", "layout");
  redirect("/admin/campaigns");
}

export async function saveCampaignAction(_: unknown, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    id = await saveCampaign(Object.fromEntries(fd.entries()));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/campaigns", "layout");
  if (!fd.get("id")) redirect(`/admin/campaigns/${id}`);
  return ok(undefined, "Draft saved.");
}

export async function deleteCampaignAction(id: string): Promise<ActionResult> {
  try {
    await deleteCampaign(id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/campaigns", "layout");
  redirect("/admin/campaigns");
}

export async function sendTestCampaignAction(id: string): Promise<ActionResult> {
  try {
    const to = await sendTestCampaign(id);
    return ok(undefined, `Test sent to ${to}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function sendCampaignAction(id: string): Promise<ActionResult> {
  try {
    const r = await sendCampaign(id);
    revalidatePath("/admin/campaigns", "layout");
    return ok(
      undefined,
      `Sent to ${r.sent} customer${r.sent === 1 ? "" : "s"}${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} skipped` : ""}.`,
    );
  } catch (e) {
    return fail(e);
  }
}

export async function unsubscribeAction(customerId: string, token: string): Promise<ActionResult> {
  try {
    await unsubscribeFromLink(customerId, token);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
