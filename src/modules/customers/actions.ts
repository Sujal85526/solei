"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { CustomerOption } from "./queries";
import * as customers from "./service";
import * as welcome from "./welcome";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

function refresh(id?: string) {
  revalidatePath("/admin/customers");
  if (id) revalidatePath(`/admin/customers/${id}`);
}

/** Debounced picker search. Returns [] for blank queries. */
export async function searchCustomersAction(
  query: string,
): Promise<ActionResult<CustomerOption[]>> {
  try {
    return ok(await customers.searchCustomers(query));
  } catch (e) {
    return fail(e);
  }
}

export async function createCustomerAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ customer: CustomerOption; existing: boolean }>> {
  try {
    const res = await customers.createCustomer(entries(fd));
    refresh();
    const message = res.existing
      ? "This customer already exists — selected their record."
      : res.welcome?.sent
        ? "Customer created — welcome email sent."
        : res.welcome
          ? `Customer created. Welcome email not sent: ${res.welcome.reason}`
          : "Customer created.";
    return ok(res, message);
  } catch (e) {
    return fail(e);
  }
}

export async function updateContactAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await customers.updateContact(entries(fd));
    refresh(String(fd.get("id")));
    return ok(undefined, "Contact details saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateNotesAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await customers.updateNotes(entries(fd));
    refresh(String(fd.get("id")));
    return ok(undefined, "Notes saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function recordConsentAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await customers.recordConsent({ id: fd.get("id"), channels: fd.getAll("channels") });
    refresh(String(fd.get("id")));
    return ok(undefined, "Marketing consent recorded.");
  } catch (e) {
    return fail(e);
  }
}

export async function recordOptOutAction(id: string): Promise<ActionResult> {
  try {
    await customers.recordOptOut({ id });
    refresh(id);
    return ok(undefined, "Opt-out recorded — no more marketing.");
  } catch (e) {
    return fail(e);
  }
}

/** Delete a customer for good, then back to the customers list. */
export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  try {
    await customers.deleteCustomer(id);
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect("/admin/customers");
}

/** Send (or, with `force`, re-send) the welcome-to-the-website email to one customer. */
export async function sendWelcomeAction(id: string, force = false): Promise<ActionResult> {
  try {
    await welcome.sendWelcome(id, { force });
    refresh(id);
    return ok(undefined, "Welcome email sent.");
  } catch (e) {
    return fail(e);
  }
}

/** Send the welcome email to the next batch of customers who haven't had it. */
export async function sendWelcomeBatchAction(): Promise<ActionResult<welcome.BatchResult>> {
  try {
    const res = await welcome.sendWelcomeBatch();
    refresh();
    const left = res.remaining ? ` ${res.remaining} still to go — click again.` : "";
    const bad = res.failed ? ` ${res.failed} couldn't be sent.` : "";
    return ok(res, `${res.sent} welcome ${res.sent === 1 ? "email" : "emails"} sent.${bad}${left}`);
  } catch (e) {
    return fail(e);
  }
}
