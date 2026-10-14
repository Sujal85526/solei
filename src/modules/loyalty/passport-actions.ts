"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { passportEmailSchema } from "./schema";

export type PassportLinkState =
  { status: "idle" } | { status: "sent" } | { status: "invalid"; error: string };

/**
 * Customer passport sign-in by email magic link. A link is only sent when the email belongs to a
 * customer (no stray accounts for strangers); the answer is the same either way so the form can't
 * be used to discover who shops with Solei. The auth user is linked to the customer on first visit.
 */
export async function requestPassportLinkAction(
  _: PassportLinkState,
  fd: FormData,
): Promise<PassportLinkState> {
  const parsed = passportEmailSchema.safeParse({ email: fd.get("email") });
  if (!parsed.success) {
    return { status: "invalid", error: parsed.error.issues[0]?.message ?? "Enter your email" };
  }
  const { email } = parsed.data;
  const { count, error } = await createAdminClient()
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("email", email);
  if (error) {
    console.error("passport lookup failed", error.message);
    return { status: "sent" };
  }
  if (count) {
    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/passport`,
        shouldCreateUser: true,
      },
    });
    if (otpError) console.error("passport magic link failed", otpError.message);
  }
  return { status: "sent" };
}

export async function signOutPassportAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/passport");
}
