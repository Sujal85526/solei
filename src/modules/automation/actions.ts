"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CONTENT_TAGS } from "@/modules/content/queries";
import {
  announceEvent,
  joinEventNews,
  runFeedbackRequestsNow,
  runStaffRemindersNow,
  saveAutomationSettings,
  saveLabelRules,
  setCustomerEventNews,
  setMyEventNews,
  stopFeedbackFromLink,
  submitFeedbackFromLink,
} from "./service";

const tally = (r: { sent: number; skipped: number }, nothing: string) =>
  r.sent || r.skipped ? `${r.sent} sent${r.skipped ? `, ${r.skipped} skipped` : ""}.` : nothing;

export async function saveLabelRulesAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveLabelRules(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/customers", "layout");
    return ok(undefined, "Label rules saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveAutomationSettingsAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult> {
  try {
    await saveAutomationSettings(Object.fromEntries(fd.entries()));
    updateTag(CONTENT_TAGS.settings);
    revalidatePath("/admin/customers/settings");
    return ok(undefined, "Email settings saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function runFeedbackRequestsAction(): Promise<ActionResult> {
  try {
    const r = await runFeedbackRequestsNow();
    revalidatePath("/admin/customers/settings");
    return ok(undefined, tally(r, "No orders are due a feedback request right now."));
  } catch (e) {
    return fail(e);
  }
}

export async function runStaffRemindersAction(): Promise<ActionResult> {
  try {
    return ok(undefined, tally(await runStaffRemindersNow(), "No reminders are due right now."));
  } catch (e) {
    return fail(e);
  }
}

export async function submitFeedbackAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await submitFeedbackFromLink(Object.fromEntries(fd.entries()));
    return ok(undefined, "Thank you!");
  } catch (e) {
    return fail(e);
  }
}

export async function stopFeedbackAction(orderId: string, token: string): Promise<ActionResult> {
  try {
    await stopFeedbackFromLink(orderId, token);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function joinEventNewsAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await joinEventNews(Object.fromEntries(fd.entries()));
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function setMyEventNewsAction(on: boolean): Promise<ActionResult> {
  try {
    await setMyEventNews(on);
    revalidatePath("/account");
    return ok(undefined, on ? "You'll hear about our events." : "Event news is off.");
  } catch (e) {
    return fail(e);
  }
}

export async function setCustomerEventNewsAction(id: string, on: boolean): Promise<ActionResult> {
  try {
    await setCustomerEventNews(id, on);
    revalidatePath(`/admin/customers/${id}`);
    return ok(undefined, on ? "Added to event news." : "Removed from event news.");
  } catch (e) {
    return fail(e);
  }
}

export async function announceEventAction(eventId: string): Promise<ActionResult> {
  let id: string;
  try {
    id = await announceEvent(eventId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/campaigns", "layout");
  redirect(`/admin/campaigns/${id}`);
}
