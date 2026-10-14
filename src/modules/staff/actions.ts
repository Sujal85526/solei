"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import * as staff from "./service";

const checkbox = (v: FormDataEntryValue | null) => v === "on" || v === "true";

export async function inviteStaffAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const res = await staff.inviteStaff({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      roleId: fd.get("roleId"),
      position: fd.get("position"),
      phone: fd.get("phone"),
      employmentStatus: fd.get("employmentStatus") || undefined,
    });
    revalidatePath("/admin/staff");
    return ok(res, "Invitation sent.");
  } catch (e) {
    return fail(e);
  }
}

export async function updateStaffAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await staff.updateStaff({
      userId: fd.get("userId"),
      fullName: fd.get("fullName"),
      roleId: fd.get("roleId"),
      position: fd.get("position"),
      phone: fd.get("phone"),
      employmentStatus: fd.get("employmentStatus"),
    });
    revalidatePath("/admin/staff");
    return ok(undefined, "Saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function setStaffActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  try {
    await staff.setStaffActive(userId, active);
    revalidatePath("/admin/staff");
    return ok(undefined, active ? "Account reactivated." : "Account deactivated — access removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function sendPasswordResetAction(userId: string): Promise<ActionResult> {
  try {
    await staff.sendPasswordReset(userId);
    return ok(undefined, "Password reset email sent.");
  } catch (e) {
    return fail(e);
  }
}

export async function setRolePermissionsAction(
  roleId: string,
  permissions: string[],
): Promise<ActionResult> {
  try {
    const res = await staff.setRolePermissions({ roleId, permissions });
    revalidatePath("/admin/staff/roles");
    return ok(undefined, res.added + res.removed ? "Permissions updated." : "No changes.");
  } catch (e) {
    return fail(e);
  }
}

export async function createRoleAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ roleId: string }>> {
  try {
    const res = await staff.createRole({
      name: fd.get("name"),
      requiresMfa: checkbox(fd.get("requiresMfa")),
      copyFromRoleId: fd.get("copyFromRoleId") ?? undefined,
    });
    revalidatePath("/admin/staff/roles");
    return ok(res, "Role created.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  try {
    await staff.deleteRole(roleId);
    revalidatePath("/admin/staff/roles");
    return ok(undefined, "Role deleted.");
  } catch (e) {
    return fail(e);
  }
}
