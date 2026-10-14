import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  NotificationTabs,
  OwnerEmailForm,
} from "@/components/admin/notifications/owner-email-form";
import { TemplateToggle } from "@/components/admin/notifications/template-toggle";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listTemplates, ownerAlertEmail } from "@/modules/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

const AUDIENCES = [
  { key: "customer", title: "To customers" },
  { key: "owner", title: "To the owner" },
] as const;

export default async function NotificationsPage() {
  const staff = await requirePagePermission("notifications.manage");
  const [templates, owner] = await Promise.all([listTemplates(), ownerAlertEmail()]);
  const canOwner = can(staff.permissions, "settings.manage") && owner.readable;

  return (
    <>
      <Link
        href="/admin/settings"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Settings
      </Link>
      <PageHeader
        title="Notifications"
        description="Edit the wording of every email and turn each one on or off."
      />
      <NotificationTabs />
      <div className="flex flex-col gap-6">
        {canOwner ? (
          <AdminSection>
            <OwnerEmailForm email={owner.email} />
          </AdminSection>
        ) : null}
        {AUDIENCES.map((a) => (
          <AdminSection key={a.key} title={a.title}>
            <ul className="divide-y">
              {templates
                .filter((t) => t.audience === a.key)
                .map((t) => (
                  <li key={t.key} className="flex items-center gap-4 py-3">
                    <Link
                      href={`/admin/settings/notifications/${t.key}`}
                      className="group min-w-0 flex-1"
                    >
                      <span className="flex items-center gap-2 font-medium group-hover:underline">
                        {t.name}
                        {!t.enabled ? <Badge variant="muted">Off</Badge> : null}
                      </span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {t.description}
                      </span>
                    </Link>
                    <TemplateToggle templateKey={t.key} name={t.name} enabled={t.enabled} />
                  </li>
                ))}
            </ul>
          </AdminSection>
        ))}
      </div>
    </>
  );
}
