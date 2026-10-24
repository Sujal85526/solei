import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { destinationOptions, listCampaigns, listSegments } from "@/modules/campaigns/queries";
import { rulesSummary } from "@/modules/campaigns/schema";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  await requirePagePermission("marketing.manage");
  const [campaigns, segments, destinations] = await Promise.all([
    listCampaigns(),
    listSegments(),
    destinationOptions(),
  ]);
  const names = new Map(destinations.map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Email customers who agreed to hear from Solei — every email has an unsubscribe link."
        actions={
          <>
            <Link
              href="/admin/campaigns/segments/new"
              className={buttonVariants({ variant: "outline" })}
            >
              <Plus /> New segment
            </Link>
            <Link href="/admin/campaigns/new" className={buttonVariants()}>
              <Plus /> New campaign
            </Link>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <AdminSection title="Campaigns">
          {campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              None yet. Build a segment first, then write a campaign to it.
            </p>
          ) : (
            <ul className="-mx-5 divide-y sm:-mx-6">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="hover:bg-muted/50 flex items-center gap-4 px-5 py-3.5 transition-colors sm:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {c.status === "draft"
                          ? `Draft · edited ${formatBusinessDate(c.updatedAt)}`
                          : `${c.counts.sent} sent${c.counts.failed ? ` · ${c.counts.failed} failed` : ""} · ${c.segmentName ?? "—"}${c.sentAt ? ` · ${formatBusinessDate(c.sentAt)}` : ""}`}
                      </span>
                    </span>
                    <Badge
                      variant={
                        c.status === "sent"
                          ? "success"
                          : c.status === "sending"
                            ? "warning"
                            : "outline"
                      }
                    >
                      {c.status === "sent" ? "Sent" : c.status === "sending" ? "Sending" : "Draft"}
                    </Badge>
                    <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>

        <AdminSection title="Segments" description="Saved groups of customers.">
          {segments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              None yet — e.g. &ldquo;Spent AED 500+&rdquo; or &ldquo;Nothing in 90 days&rdquo;.
            </p>
          ) : (
            <ul className="-mx-5 divide-y sm:-mx-6">
              {segments.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/campaigns/segments/${s.id}`}
                    className="hover:bg-muted/50 flex items-center gap-4 px-5 py-3.5 transition-colors sm:px-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {rulesSummary(s.rules, names)}
                      </span>
                    </span>
                    <span className="numeric text-muted-foreground shrink-0 text-end text-xs">
                      <span className="text-foreground block text-sm">{s.total}</span>
                      {s.emailable} reachable
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AdminSection>
      </div>
    </>
  );
}
