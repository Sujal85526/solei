import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { can, type PermissionKey } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export type StaffContext = {
  userId: string;
  email: string;
  name: string;
  roleKey: string;
  roleName: string;
  requiresMfa: boolean;
  permissions: Set<string>;
};

export class PermissionError extends Error {
  constructor(public readonly permission: string) {
    super(`You don't have permission to do that (${permission}).`);
    this.name = "PermissionError";
  }
}

type GateResult =
  | { status: "signed_out" }
  | { status: "not_staff"; email: string }
  | { status: "inactive"; email: string }
  | { status: "mfa_enroll" | "mfa_verify"; email: string }
  | { status: "ok"; staff: StaffContext };

/**
 * Resolves the signed-in staff member for this request (deduplicated per request).
 * The database enforces the same rules (has_permission / RLS); this drives redirects and UI.
 */
export const resolveStaff = cache(async (): Promise<GateResult> => {
  // Session reads are request-time; mark it before supabase-js touches Date.now().
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed_out" };
  const email = user.email ?? "";

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("full_name, active, roles(key, name, requires_mfa)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || !profile.roles) return { status: "not_staff", email };
  if (!profile.active) return { status: "inactive", email };

  if (profile.roles.requires_mfa) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") {
      return { status: aal?.nextLevel === "aal2" ? "mfa_verify" : "mfa_enroll", email };
    }
  }

  const { data: perms, error } = await supabase.rpc("my_permissions");
  if (error) throw new Error(`Could not load permissions: ${error.message}`);

  return {
    status: "ok",
    staff: {
      userId: user.id,
      email,
      name: profile.full_name,
      roleKey: profile.roles.key,
      roleName: profile.roles.name,
      requiresMfa: profile.roles.requires_mfa,
      permissions: new Set(perms ?? []),
    },
  };
});

/** For admin pages/layouts: returns the staff context or redirects to the right auth step. */
export async function requireStaff(): Promise<StaffContext> {
  const gate = await resolveStaff();
  switch (gate.status) {
    case "ok":
      return gate.staff;
    case "signed_out":
      redirect("/admin/login");
    case "mfa_enroll":
    case "mfa_verify":
      redirect("/admin/mfa");
    case "inactive":
      redirect("/admin/login?error=inactive");
    case "not_staff":
      redirect("/admin/login?error=not_staff");
  }
}

/** For admin pages: also requires a permission, otherwise renders the forbidden page. */
export async function requirePagePermission(key: PermissionKey): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!can(staff.permissions, key)) redirect(`/admin/forbidden?need=${encodeURIComponent(key)}`);
  return staff;
}

/** For server actions: throws PermissionError instead of redirecting. */
export async function assertPermission(key: PermissionKey): Promise<StaffContext> {
  const gate = await resolveStaff();
  if (gate.status !== "ok") throw new PermissionError(key);
  if (!can(gate.staff.permissions, key)) throw new PermissionError(key);
  return gate.staff;
}
