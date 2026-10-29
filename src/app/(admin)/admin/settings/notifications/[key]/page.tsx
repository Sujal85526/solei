import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TemplateEditor } from "@/components/admin/notifications/template-editor";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { getTemplate } from "@/modules/notifications/queries";

export const metadata: Metadata = { title: "Edit email" };

export default async function TemplatePage({
  params,
}: PageProps<"/admin/settings/notifications/[key]">) {
  const staff = await requirePagePermission("notifications.manage");
  const { key } = await params;
  if (!/^[a-z_]+$/.test(key)) notFound();
  const template = await getTemplate(key);
  if (!template) notFound();

  return (
    <>
      <Link
        href="/admin/settings/notifications"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Notifications
      </Link>
      <PageHeader
        title={template.name}
        description={
          <>
            {template.description}{" "}
            <Badge variant="outline" className="ms-1">
              {template.audience === "owner"
                ? "To the owner"
                : template.audience === "staff"
                  ? "To staff"
                  : "To the customer"}
            </Badge>
          </>
        }
      />
      <TemplateEditor
        template={{
          key: template.key,
          subject: template.subject,
          body: template.body,
          enabled: template.enabled,
          variables: template.variables,
        }}
        siteUrl={publicEnv.NEXT_PUBLIC_SITE_URL}
        testRecipient={staff.email}
      />
    </>
  );
}
