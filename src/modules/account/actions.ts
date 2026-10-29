"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import * as account from "./service";
import { sendAccountWelcome } from "./welcome";

export async function signInAction(input: unknown): Promise<ActionResult<account.SignInResult>> {
  try {
    return ok(await account.signIn(input));
  } catch (e) {
    return fail(e);
  }
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  try {
    return ok(await account.signUp(input));
  } catch (e) {
    return fail(e);
  }
}

export async function verifyCodeAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await account.verifyCode(input);
    // Welcome email (once per address) — after the response, so verifying isn't slowed down.
    if (user) after(() => sendAccountWelcome(user));
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function resendCodeAction(
  input: unknown,
  kind: "verify" | "reset",
): Promise<ActionResult> {
  try {
    await account.resendCode(input, kind === "reset" ? "reset" : "verify");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function requestResetAction(input: unknown): Promise<ActionResult> {
  return resendCodeAction(input, "reset");
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    await account.resetPassword(input);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function signOutAction(): Promise<ActionResult> {
  try {
    await account.signOut();
    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function saveProfileAction(input: unknown): Promise<ActionResult> {
  try {
    await account.saveProfile(input);
    return ok(undefined, "Saved");
  } catch (e) {
    return fail(e);
  }
}

export async function saveAddressAction(input: unknown): Promise<ActionResult> {
  try {
    await account.saveAddress(input);
    return ok(undefined, "Saved");
  } catch (e) {
    return fail(e);
  }
}
