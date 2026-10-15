import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { HelpTopicForm } from "@/components/admin/help/help-topic-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getHelpTopicForAdmin } from "@/modules/help/queries";

export const metadata: Metadata = { title: "Edit help topic" };

export default async function HelpTopicPage({ params }: PageProps<"/admin/settings/help/[slug]">) {
  await requirePagePermission("settings.manage");
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) notFound();
  const topic = await getHelpTopicForAdmin(slug);
  if (!topic) notFound();
  return (
    <>
      <Link
        href="/admin/settings/help"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Help & policies
      </Link>
      <PageHeader
        title={topic.title}
        actions={
          <Link
            href={`/help?tab=${topic.slug}`}
            target="_blank"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            View on site <ExternalLink className="size-3.5" />
          </Link>
        }
      />
      <HelpTopicForm topic={topic} />
    </>
  );
}
