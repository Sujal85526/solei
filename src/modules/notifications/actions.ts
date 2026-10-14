"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import * as notifications from "./service";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());
const BASE = "/admin/settings/notifications";

export async function saveTemplateAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await notifications.saveTemplate(entries(fd));
    revalidatePath(BASE, "layout");
    return ok(undefined, "Template saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function setTemplateEnabledAction(
  key: string,
  enabled: boolean,
): Promise<ActionResult> {
  try {
    await notifications.setTemplateEnabled({ key, enabled });
    revalidatePath(BASE, "layout");
    return ok(undefined, enabled ? "Email turned on." : "Email turned off.");
  } catch (e) {
    return fail(e);
  }
}

export async function sendTestAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const r = await notifications.sendTest(entries(fd));
    revalidatePath(`${BASE}/outbox`);
    return ok(
      undefined,
      r.provider === "log"
        ? `Test logged for ${r.to} (email sending isn't configured — see the outbox).`
        : `Test sent to ${r.to}.`,
    );
  } catch (e) {
    return fail(e);
  }
}

export async function saveOwnerEmailAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await notifications.saveOwnerEmail(entries(fd));
    revalidatePath(BASE);
    return ok(undefined, "Owner alert email saved.");
  } catch (e) {
    return fail(e);
  }
}
