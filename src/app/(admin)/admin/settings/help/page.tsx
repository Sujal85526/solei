import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { listHelpTopicsForAdmin } from "@/modules/help/queries";

export const metadata: Metadata = { title: "Help & policies" };

export default async function HelpTopicsPage() {
  await requirePagePermission("settings.manage");
  const topics = await listHelpTopicsForAdmin();
  return (
    <>
      <PageHeader
        title="Help & policies"
        description={
          <>
            The topics on the{" "}
            <Link href="/help" target="_blank" className="underline underline-offset-4">
              Help page
            </Link>{" "}
            — shipping, returns, passport terms, terms of service, privacy and cookies.
          </>
        }
      />
      <ul className="bg-card divide-y rounded-xl border">
        {topics.map((t) => {
          const toConfirm = (t.body.match(/\[[^\]\n]+\]/g) ?? []).length;
          return (
            <li key={t.id}>
              <Link
                href={`/admin/settings/help/${t.slug}`}
                className="hover:bg-muted/50 flex items-center gap-4 px-5 py-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t.title}</span>
                  <span className="text-muted-foreground block text-xs">
                    {toConfirm
                      ? `${toConfirm} detail${toConfirm === 1 ? "" : "s"} to confirm`
                      : "Ready"}
                  </span>
                </span>
                {!t.published ? <Badge variant="outline">Hidden</Badge> : null}
                <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
