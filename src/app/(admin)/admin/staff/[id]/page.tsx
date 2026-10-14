import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StaffAccessActions, StaffEditForm } from "@/components/admin/staff/staff-edit";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { listRoles, getStaff } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Staff member" };

export default async function StaffMemberPage({ params }: PageProps<"/admin/staff/[id]">) {
  const me = await requirePagePermission("staff.manage");
  const { id } = await params;
  const [staff, roles] = await Promise.all([getStaff(id), listRoles()]);
  if (!staff) notFound();
  const isSelf = staff.user_id === me.userId;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/staff"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Staff
      </Link>
      <PageHeader
        title={staff.full_name}
        description={
          <>
            {staff.email} · added {formatBusinessDate(staff.created_at)}{" "}
            {staff.active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="muted">Deactivated</Badge>
            )}
          </>
        }
      />
      <section className="bg-card rounded-xl border p-5 sm:p-6">
        <h2 className="text-foreground mb-5 font-sans text-base font-semibold">Details</h2>
        <StaffEditForm
          staff={staff}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          isSelf={isSelf}
        />
      </section>
      <section className="bg-card mt-6 rounded-xl border p-5 sm:p-6">
        <h2 className="text-foreground mb-1 font-sans text-base font-semibold">Access</h2>
        <p className="text-muted-foreground mb-5 text-sm">
          Deactivating removes access immediately. Their past sales and activity are kept.
        </p>
        <StaffAccessActions staff={staff} isSelf={isSelf} />
      </section>
    </div>
  );
}
