import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { InviteStaffDialog } from "@/components/admin/staff/invite-staff-dialog";
import { SubNav } from "@/components/admin/sub-nav";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { listRoles, listStaff } from "@/modules/staff/queries";
import { employmentStatusLabels } from "@/modules/staff/schema";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  await requirePagePermission("staff.manage");
  const [staff, roles] = await Promise.all([listStaff(), listRoles()]);
  return (
    <>
      <PageHeader
        title="Staff"
        description="Invite your team, choose what each role can see and do."
        actions={<InviteStaffDialog roles={roles.map((r) => ({ id: r.id, name: r.name }))} />}
      />
      <SubNav
        items={[
          { href: "/admin/staff", label: "Team" },
          { href: "/admin/staff/roles", label: "Roles & permissions" },
        ]}
      />
      <ul className="bg-card divide-y rounded-xl border">
        {staff.map((s) => (
          <li key={s.user_id}>
            <Link
              href={`/admin/staff/${s.user_id}`}
              className="hover:bg-muted/60 flex items-center gap-4 px-4 py-4 sm:px-5"
            >
              <span
                aria-hidden
                className="bg-pink font-display text-burgundy flex size-10 shrink-0 items-center justify-center rounded-full text-lg"
              >
                {s.full_name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {s.full_name}
                  {!s.active ? <Badge variant="muted">Deactivated</Badge> : null}
                </span>
                <span className="text-muted-foreground block truncate text-sm">
                  {s.email}
                  {s.position ? ` · ${s.position}` : ""}
                </span>
              </span>
              <span className="hidden flex-col items-end gap-1 sm:flex">
                <Badge variant={s.roles?.key === "owner" ? "default" : "secondary"}>
                  {s.roles?.name}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {
                    employmentStatusLabels[
                      s.employment_status as keyof typeof employmentStatusLabels
                    ]
                  }
                </span>
              </span>
              <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
