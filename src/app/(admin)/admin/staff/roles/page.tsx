import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CreateRoleDialog } from "@/components/admin/staff/create-role-dialog";
import { RoleMatrix } from "@/components/admin/staff/role-matrix";
import { SubNav } from "@/components/admin/sub-nav";
import { requirePagePermission } from "@/lib/auth/session";
import { listRoles } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  await requirePagePermission("staff.manage");
  const roles = await listRoles();
  return (
    <>
      <PageHeader
        title="Staff"
        description="Changes apply immediately to everyone with the role."
        actions={<CreateRoleDialog roles={roles.map((r) => ({ id: r.id, name: r.name }))} />}
      />
      <SubNav
        items={[
          { href: "/admin/staff", label: "Team" },
          { href: "/admin/staff/roles", label: "Roles & permissions" },
        ]}
      />
      <RoleMatrix roles={roles} />
    </>
  );
}
