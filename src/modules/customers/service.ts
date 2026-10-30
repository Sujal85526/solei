import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { adjustStamps } from "@/modules/loyalty/service";
import { searchCustomerOptions, toOption, type CustomerOption } from "./queries";
import {
  consentChannels,
  createCustomerSchema,
  optOutSchema,
  recordConsentSchema,
  updateContactSchema,
  updateNotesSchema,
} from "./schema";
import { sendWelcome } from "./welcome";

/*
 * Customer writes go through the caller's session: RLS requires customers.manage and the
 * generic audit trigger on `customers` records actor + before/after for every change.
 */

type DbError = { message: string; code?: string; details?: string };

function dbError(error: DbError): never {
  if (error.code === "23505") {
    if (/phone/.test(error.message + (error.details ?? "")))
      throw new UserError("Another customer already has this phone number.");
    throw new UserError("Another customer already has these details.");
  }
  if (error.code === "23514" && /contact_required/.test(error.message))
    throw new UserError("Enter a phone number or an email.");
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  throw new Error(error.message);
}

export async function searchCustomers(query: unknown): Promise<CustomerOption[]> {
  await assertPermission("customers.view");
  if (typeof query !== "string") return [];
  return searchCustomerOptions(query.slice(0, 80));
}

/**
 * Quick-create. Dedupes like `upsert_customer`: an existing customer with the same email, or else the same
 * phone, is returned instead of creating a duplicate (one email = one record to link an account to).
 */
export type WelcomeOutcome = { sent: true } | { sent: false; reason: string };

export async function createCustomer(
  input: unknown,
): Promise<{ customer: CustomerOption; existing: boolean; welcome?: WelcomeOutcome }> {
  await assertPermission("customers.manage");
  const v = createCustomerSchema.parse(input);
  const supabase = await createClient();

  const findExisting = async () => {
    const select = () =>
      supabase
        .from("customer_summary")
        .select("id, name, phone, email, emirate, marketing_consent, order_count");
    if (v.email) {
      const { data } = await select()
        .eq("email", v.email)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (data?.id) return toOption(data);
    }
    if (v.phone) {
      const { data: byPhone } = await select().eq("phone", v.phone).maybeSingle();
      if (byPhone?.id) return toOption(byPhone);
    }
    return null;
  };

  const existing = await findExisting();
  if (existing) return { customer: existing, existing: true };

  // Check before saving anything, so a refusal can't leave a half-created customer behind.
  if (v.pastStamps > 0) await assertPermission("loyalty.adjust");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: v.name,
      phone: v.phone,
      email: v.email,
      emirate: v.emirate,
      source: v.source,
      marketing_consent: v.marketingConsent,
      marketing_consent_at: v.marketingConsent ? now : null,
      marketing_channels: v.marketingConsent ? consentChannels(v) : [],
    })
    .select("id, name, phone, email, emirate, marketing_consent")
    .single();
  if (error) {
    // Lost a race with another till: return the row that won.
    if (error.code === "23505") {
      const raced = await findExisting();
      if (raced) return { customer: raced, existing: true };
    }
    dbError(error);
  }

  if (v.pastStamps > 0) {
    try {
      await adjustStamps({
        customerId: data.id,
        direction: "add",
        stamps: v.pastStamps,
        reason: "Stickers from earlier orders (before the website)",
      });
    } catch (e) {
      const why = e instanceof UserError ? ` (${e.message})` : "";
      throw new UserError(
        `Customer saved, but the stickers couldn't be added${why}. Open their page and use Adjust stamps.`,
      );
    }
  }

  // After the stickers, so the email shows the right count. A failed email never undoes the customer.
  let welcome: WelcomeOutcome | undefined;
  if (v.sendWelcome && v.email) {
    try {
      await sendWelcome(data.id);
      welcome = { sent: true };
    } catch (e) {
      welcome = {
        sent: false,
        reason: e instanceof UserError ? e.message : "something went wrong",
      };
    }
  }
  return { customer: toOption({ ...data, order_count: 0 }), existing: false, welcome };
}

export async function updateContact(input: unknown) {
  await assertPermission("customers.manage");
  const v = updateContactSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      name: v.name,
      phone: v.phone,
      email: v.email,
      emirate: v.emirate,
      address: v.address,
    })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();
  if (error) dbError(error);
  if (!data) throw new UserError("Customer not found.");
}

export async function updateNotes(input: unknown) {
  await assertPermission("customers.manage");
  const v = updateNotesSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ notes: v.notes })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();
  if (error) dbError(error);
  if (!data) throw new UserError("Customer not found.");
}

/** Staff records that the customer agreed (in person / by message) to marketing on channels. */
export async function recordConsent(input: unknown) {
  await assertPermission("customers.manage");
  const v = recordConsentSchema.parse(input);
  const supabase = await createClient();
  const { data: current, error: e1 } = await supabase
    .from("customers")
    .select("phone, email")
    .eq("id", v.id)
    .maybeSingle();
  if (e1) dbError(e1);
  if (!current) throw new UserError("Customer not found.");
  if (v.channels.includes("whatsapp") && !current.phone)
    throw new UserError("Add a phone number before recording WhatsApp consent.");
  if (v.channels.includes("email") && !current.email)
    throw new UserError("Add an email before recording email consent.");

  const { error } = await supabase
    .from("customers")
    .update({
      marketing_consent: true,
      marketing_consent_at: new Date().toISOString(),
      marketing_channels: v.channels,
      unsubscribed_at: null,
    })
    .eq("id", v.id);
  if (error) dbError(error);
}

/**
 * Wipe a customer: the record, their Passport stickers and their website login (so the same email
 * can sign up again). Orders, bookings and reviews stay for the books, just no longer linked to
 * anyone (the foreign keys set them to null). A staff login is never removed.
 */
export async function deleteCustomer(id: unknown) {
  await assertPermission("customers.manage");
  const customerId = optOutSchema.parse({ id }).id;
  const supabase = await createClient();
  const { data: customer, error: readError } = await supabase
    .from("customers")
    .select("id, auth_user_id")
    .eq("id", customerId)
    .maybeSingle();
  if (readError) dbError(readError);
  if (!customer) throw new UserError("Customer not found.");

  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) dbError(error);

  if (customer.auth_user_id) {
    const admin = createAdminClient();
    const { data: staff } = await admin
      .from("staff_profiles")
      .select("user_id")
      .eq("user_id", customer.auth_user_id)
      .maybeSingle();
    if (!staff) {
      const { error: authError } = await admin.auth.admin.deleteUser(customer.auth_user_id);
      if (authError) console.error("customer login not removed", customerId, authError);
    }
  }
}

/** Opt-out: consent off on every channel, with the time it was recorded. */
export async function recordOptOut(input: unknown) {
  await assertPermission("customers.manage");
  const v = optOutSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      marketing_consent: false,
      marketing_channels: [],
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();
  if (error) dbError(error);
  if (!data) throw new UserError("Customer not found.");
}
