"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { CustomerOption } from "./queries";
import * as customers from "./service";

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
    return ok(
      res,
      res.existing ? "This customer already exists — selected their record." : "Customer created.",
    );
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
