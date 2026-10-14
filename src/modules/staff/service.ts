import "server-only";
import { publicEnv } from "@/lib/env";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  createRoleSchema,
  inviteStaffSchema,
  roleKeyFromName,
  rolePermissionsSchema,
  updateStaffSchema,
} from "./schema";

const BAN_FOREVER = "876000h";

async function ownerCount(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { count } = await supabase
    .from("staff_profiles")
    .select("user_id, roles!inner(key)", { count: "exact", head: true })
    .eq("active", true)
    .eq("roles.key", "owner");
  return count ?? 0;
}

async function roleKeyOf(supabase: Awaited<ReturnType<typeof createClient>>, roleId: string) {
  const { data } = await supabase.from("roles").select("key").eq("id", roleId).single();
  if (!data) throw new UserError("That role no longer exists.");
  return data.key;
}

/** Invite a staff member by email; they set their own password from the invite link. */
export async function inviteStaff(input: unknown) {
  await assertPermission("staff.manage");
  const v = inviteStaffSchema.parse(input);
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(v.email, {
    data: { full_name: v.fullName },
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/set-password`,
  });
  if (error || !invited.user) {
    if (error?.code === "email_exists" || /already been registered/i.test(error?.message ?? "")) {
      throw new UserError("Someone with this email already has an account.");
    }
    throw new Error(`invite failed: ${error?.message}`);
  }

  const { error: insertError } = await supabase.from("staff_profiles").insert({
    user_id: invited.user.id,
    full_name: v.fullName,
    email: v.email,
    role_id: v.roleId,
    position: v.position ?? null,
    phone: v.phone ?? null,
    employment_status: v.employmentStatus,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    throw new Error(`staff insert failed: ${insertError.message}`);
  }
  return { userId: invited.user.id };
}

export async function updateStaff(input: unknown) {
  const me = await assertPermission("staff.manage");
  const v = updateStaffSchema.parse(input);
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("staff_profiles")
    .select("role_id, roles(key)")
    .eq("user_id", v.userId)
    .single();
  if (!current) throw new UserError("Staff member not found.");

  if (current.role_id !== v.roleId) {
    if (v.userId === me.userId) throw new UserError("You can't change your own role.");
    if (current.roles?.key === "owner" && (await ownerCount(supabase)) <= 1) {
      throw new UserError("There must always be at least one active owner.");
    }
  }

  const { error } = await supabase
    .from("staff_profiles")
    .update({
      full_name: v.fullName,
      role_id: v.roleId,
      position: v.position ?? null,
      phone: v.phone ?? null,
      employment_status: v.employmentStatus,
    })
    .eq("user_id", v.userId);
  if (error) throw new Error(error.message);
}

/** Deactivation takes effect immediately: permissions are checked live and the auth user is banned. */
export async function setStaffActive(userId: string, active: boolean) {
  const me = await assertPermission("staff.manage");
  if (userId === me.userId) throw new UserError("You can't deactivate your own account.");
  const supabase = await createClient();

  const roleKey = await supabase
    .from("staff_profiles")
    .select("roles(key)")
    .eq("user_id", userId)
    .single()
    .then((r) => r.data?.roles?.key);
  if (!active && roleKey === "owner" && (await ownerCount(supabase)) <= 1) {
    throw new UserError("There must always be at least one active owner.");
  }

  const { error } = await supabase
    .from("staff_profiles")
    .update({ active, deactivated_at: active ? null : new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const { error: banError } = await createAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (banError) throw new Error(`ban update failed: ${banError.message}`);
}

export async function sendPasswordReset(userId: string) {
  await assertPermission("staff.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("email")
    .eq("user_id", userId)
    .single();
  if (!data) throw new UserError("Staff member not found.");
  const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/set-password`,
  });
  if (error) throw new Error(error.message);
}

export async function setRolePermissions(input: unknown) {
  await assertPermission("staff.manage");
  const v = rolePermissionsSchema.parse(input);
  const supabase = await createClient();
  if ((await roleKeyOf(supabase, v.roleId)) === "owner") {
    throw new UserError("The owner role always has every permission.");
  }

  const { data: existing } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", v.roleId);
  const before = new Set((existing ?? []).map((r) => r.permission_key));
  const after = new Set(v.permissions);
  const toAdd = [...after].filter((k) => !before.has(k));
  const toRemove = [...before].filter((k) => !after.has(k));

  if (toAdd.length) {
    const { error } = await supabase
      .from("role_permissions")
      .insert(toAdd.map((permission_key) => ({ role_id: v.roleId, permission_key })));
    if (error) throw new Error(error.message);
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", v.roleId)
      .in("permission_key", toRemove);
    if (error) throw new Error(error.message);
  }
  return { added: toAdd.length, removed: toRemove.length };
}

export async function createRole(input: unknown) {
  await assertPermission("staff.manage");
  const v = createRoleSchema.parse(input);
  const supabase = await createClient();
  const key = roleKeyFromName(v.name);
  if (!key) throw new UserError("Use letters or numbers in the role name.");

  const { data: role, error } = await supabase
    .from("roles")
    .insert({ key, name: v.name, requires_mfa: v.requiresMfa })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new UserError("A role with that name already exists.");
    throw new Error(error.message);
  }
  if (v.copyFromRoleId) {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("permission_key")
      .eq("role_id", v.copyFromRoleId);
    if (perms?.length) {
      await supabase
        .from("role_permissions")
        .insert(perms.map((p) => ({ role_id: role.id, permission_key: p.permission_key })));
    }
  }
  return { roleId: role.id };
}

export async function deleteRole(roleId: string) {
  await assertPermission("staff.manage");
  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("is_system").eq("id", roleId).single();
  if (!role) throw new UserError("Role not found.");
  if (role.is_system) throw new UserError("Built-in roles can't be deleted.");
  const { count } = await supabase
    .from("staff_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role_id", roleId);
  if (count) throw new UserError("Move staff to another role before deleting this one.");
  const { error } = await supabase.from("roles").delete().eq("id", roleId);
  if (error) throw new Error(error.message);
}
