"use server";

import { redirect } from "next/navigation";
import { publicEnv } from "@/lib/env";
import { writeSystemAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, loginSchema, passwordSchema, safeAdminPath, totpCodeSchema } from "./schema";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; message?: string };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const { email, password, next } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await writeSystemAudit({
      action: "auth.login_failed",
      entity: "auth",
      after: { email, reason: error?.code ?? "unknown" },
    });
    return { error: "That email and password don't match an active account." };
  }
  await writeSystemAudit({
    action: "auth.login",
    entity: "auth",
    entityId: data.user.id,
    actorId: data.user.id,
    after: { email },
  });

  // Decide the next step here so the browser goes straight to it (no redirect chain).
  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("active, roles(requires_mfa)")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have access to Solei Admin." };
  }
  if (!profile.active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact the owner." };
  }
  if (profile.roles?.requires_mfa) redirect("/admin/mfa");
  redirect(safeAdminPath(next));
}

export async function signOutAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user)
    await writeSystemAudit({
      action: "auth.logout",
      entity: "auth",
      entityId: user.id,
      actorId: user.id,
    });
  redirect("/admin/login");
}

/** Begin TOTP enrolment: clears abandoned unverified factors, returns QR + secret. */
export async function startTotpEnrollment(): Promise<
  { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified")
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Solei Admin ${new Date().toISOString().slice(0, 10)}`,
    issuer: "Solei Admin",
  });
  if (error || !data)
    return { ok: false, error: "Could not start two-factor setup. Please try again." };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = totpCodeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (error) {
    await writeSystemAudit({
      action: "auth.mfa_failed",
      entity: "auth",
      entityId: user?.id,
      actorId: user?.id,
    });
    return {
      fieldErrors: { code: "That code didn't work. Check the time on your phone and try again." },
    };
  }
  await writeSystemAudit({
    action: "auth.mfa_verified",
    entity: "auth",
    entityId: user?.id,
    actorId: user?.id,
  });
  redirect("/admin");
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/set-password`,
  });
  await writeSystemAudit({
    action: "auth.password_reset_requested",
    entity: "auth",
    after: { email: parsed.data.email },
  });
  // Same answer whether or not the account exists.
  return { message: "If that email belongs to a Solei account, a reset link is on its way." };
}

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  await writeSystemAudit({
    action: "auth.password_set",
    entity: "auth",
    entityId: user.id,
    actorId: user.id,
  });
  redirect("/admin");
}
