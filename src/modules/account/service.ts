import "server-only";
import type { User } from "@supabase/supabase-js";
import { UserError } from "@/lib/action-result";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";
import { emailProvider, recipientAllowed } from "@/providers/email";
import { accountCodeEmail } from "./emails";
import {
  addressSchema,
  codeSchema,
  emailOnlySchema,
  profileSchema,
  resetSchema,
  signInSchema,
  signUpSchema,
  type AccountMeta,
} from "./schema";

/*
 * Customer accounts (storefront). Supabase Auth holds the account; the profile (name, phone, saved
 * address) lives in `user_metadata`, and the orders placed while signed in in `app_metadata`
 * (server-only). Emails are verified with a 6-digit code we send through our email provider:
 * a Supabase recovery OTP, which signs the customer in and confirms the address when entered.
 * Accounts are only usable once verified, so `link_customer_account()` (passport) stays safe.
 */

/** Fixed test code while no email provider is configured (see ACCOUNT_TEST_CODE). */
function testCode(): string | null {
  const env = serverEnv();
  return env.RESEND_API_KEY ? null : (env.ACCOUNT_TEST_CODE ?? null);
}

export type SignInResult = { status: "signed_in" } | { status: "verify"; email: string };

async function sendCode(kind: "verify" | "reset", email: string, firstName?: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) {
    if (error.code === "user_not_found") return; // same answer either way
    throw new Error(`generateLink failed: ${error.message}`);
  }
  if (testCode()) return; // testing: the fixed code is entered instead
  const msg = accountCodeEmail(kind, data.properties.email_otp, firstName);
  if (!recipientAllowed(email)) {
    console.info(`[account] code email to ${email} skipped (not on EMAIL_ALLOWLIST)`);
    return;
  }
  await emailProvider().send({ to: email, ...msg });
}

export async function signIn(input: unknown): Promise<SignInResult> {
  const v = signInSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(v);
  if (!error) return { status: "signed_in" };
  if (error.code === "email_not_confirmed") {
    await sendCode("verify", v.email);
    return { status: "verify", email: v.email };
  }
  if (error.code === "invalid_credentials") throw new UserError("Wrong email or password.");
  if (error.status === 429) throw new UserError("Too many attempts. Try again in a few minutes.");
  throw new Error(`signIn failed: ${error.message}`);
}

/**
 * Create an account (unverified) and email a verification code. An unverified account with the
 * same email (an abandoned sign-up) is taken over by whoever verifies the new code.
 */
export async function signUp(input: unknown): Promise<{ email: string }> {
  const v = signUpSchema.parse(input);
  const meta: AccountMeta = { first_name: v.firstName, last_name: v.lastName, phone: v.phone };
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: false,
    user_metadata: meta,
  });
  if (created.error) {
    if (created.error.code !== "email_exists") {
      if (created.error.code === "weak_password") throw new UserError(created.error.message);
      throw new Error(`createUser failed: ${created.error.message}`);
    }
    const existing = await findUser(v.email);
    if (!existing || existing.email_confirmed_at) {
      throw new UserError("You already have an account with this email — sign in instead.");
    }
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: v.password,
      user_metadata: meta,
    });
    if (error) throw new Error(`updateUser failed: ${error.message}`);
  }
  await sendCode("verify", v.email, v.firstName);
  return { email: v.email };
}

/** Looks a user up by email (recovery link generation fails cleanly when there is none). */
async function findUser(email: string): Promise<User | null> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) return null;
  return data.user;
}

/** Enter the emailed code: verifies the email and signs the customer in. */
export async function verifyCode(input: unknown) {
  const v = codeSchema.parse(input);
  let token = v.code;
  const fixed = testCode();
  if (fixed) {
    if (v.code !== fixed)
      throw new UserError("That code is wrong or has expired. Ask for a new one.");
    // Swap the test code for a fresh real one so Supabase still confirms and signs in.
    const { data, error } = await createAdminClient().auth.admin.generateLink({
      type: "recovery",
      email: v.email,
    });
    if (error) throw new UserError("That code is wrong or has expired. Ask for a new one.");
    token = data.properties.email_otp;
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: v.email,
    token,
    type: "recovery",
  });
  if (error) throw new UserError("That code is wrong or has expired. Ask for a new one.");
}

export async function resendCode(input: unknown, kind: "verify" | "reset") {
  const v = emailOnlySchema.parse(input);
  await sendCode(kind, v.email);
}

/** Forgot password, step 2: the code signs the customer in, then the new password is set. */
export async function resetPassword(input: unknown) {
  const v = resetSchema.parse(input);
  await verifyCode(v);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: v.password });
  if (error) {
    if (error.code === "same_password") return;
    if (error.code === "weak_password") throw new UserError(error.message);
    throw new Error(`password update failed: ${error.message}`);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/** The signed-in customer (verified email), or null. */
export async function currentAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return null;
  return { user, meta: (user.user_metadata ?? {}) as AccountMeta };
}

export async function saveProfile(input: unknown) {
  const v = profileSchema.parse(input);
  await updateMeta({ first_name: v.firstName, last_name: v.lastName, phone: v.phone });
}

export async function saveAddress(input: unknown) {
  await updateMeta({ address: addressSchema.parse(input) });
}

async function updateMeta(patch: AccountMeta) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: patch });
  if (error) throw new Error(`profile update failed: ${error.message}`);
}

const MAX_ORDER_IDS = 200;

/** Remember an order placed while signed in (shown in the account's order history). */
export async function rememberOrder(user: User, orderId: string) {
  const ids = ((user.app_metadata?.order_ids as string[] | undefined) ?? []).filter(
    (id) => id !== orderId,
  );
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    app_metadata: { order_ids: [orderId, ...ids].slice(0, MAX_ORDER_IDS) },
  });
  if (error) console.error("rememberOrder failed", error.message);
}
