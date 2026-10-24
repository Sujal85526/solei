import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignEditor } from "@/components/admin/campaigns/campaign-editor";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { sendCampaignAction } from "@/modules/campaigns/actions";
import { campaignRecipients, getCampaign, listSegments } from "@/modules/campaigns/queries";
import { withFooter } from "@/modules/campaigns/schema";
import { renderTemplate } from "@/modules/notifications/render";

export const metadata: Metadata = { title: "Campaign" };

const STATUS_BADGE = {
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "warning" },
  skipped: { label: "Skipped", variant: "muted" },
  pending: { label: "Waiting", variant: "outline" },
} as const;

export default async function CampaignPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  const staff = await requirePagePermission("marketing.manage");
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const back = (
    <Link href="/admin/campaigns" className="underline underline-offset-4">
      Campaigns
    </Link>
  );

  if (campaign.status === "draft") {
    const segments = await listSegments();
    return (
      <>
        <PageHeader title={campaign.name} description={<>{back} · Draft</>} />
        <CampaignEditor
          key={campaign.updatedAt}
          campaign={campaign}
          segments={segments.map((s) => ({
            id: s.id,
            name: s.name,
            total: s.total,
            emailable: s.emailable,
          }))}
          testRecipient={staff.email}
        />
      </>
    );
  }

  const recipients = await campaignRecipients(id);
  const email = renderTemplate(
    { subject: campaign.subject, body: withFooter(campaign.body) },
    {
      first_name: "Layla",
      unsubscribe_link: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/unsubscribe`,
    },
  );
  return (
    <>
      <PageHeader
        title={campaign.name}
        description={
          <>
            {back} · {campaign.segmentName ?? "—"}
            {campaign.sentAt ? ` · sent ${formatBusinessDate(campaign.sentAt)}` : ""}
          </>
        }
        actions={
          campaign.status === "sending" ? (
            <ConfirmButton
              variant="default"
              title="Resume sending?"
              description={`${campaign.counts.pending} customers haven't been emailed yet. Those already emailed won't get it twice.`}
              confirmLabel="Resume"
              action={() => sendCampaignAction(campaign.id)}
            >
              Resume sending
            </ConfirmButton>
          ) : null
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sent" value={campaign.counts.sent} />
        <StatCard
          label="Failed"
          value={campaign.counts.failed}
          tone={campaign.counts.failed ? "warn" : undefined}
        />
        <StatCard
          label="Skipped"
          value={campaign.counts.skipped}
          hint="e.g. unsubscribed meanwhile"
        />
        <StatCard label="Waiting" value={campaign.counts.pending} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <AdminSection title="Recipients">
          <ul className="-mx-5 divide-y text-sm sm:-mx-6">
            {recipients.map((r) => {
              const b = STATUS_BADGE[r.status];
              return (
                <li key={r.email} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                  <span className="min-w-0 flex-1">
                    {r.customerId ? (
                      <Link
                        href={`/admin/customers/${r.customerId}`}
                        className="block truncate underline-offset-4 hover:underline"
                      >
                        {r.email}
                      </Link>
                    ) : (
                      <span className="block truncate">{r.email}</span>
                    )}
                    {r.error ? (
                      <span className="text-muted-foreground block truncate text-xs">
                        {r.error}
                      </span>
                    ) : null}
                  </span>
                  <Badge variant={b.variant}>{b.label}</Badge>
                </li>
              );
            })}
          </ul>
        </AdminSection>
        <AdminSection title="Email">
          <p className="mb-3 text-sm">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium">{email.subject}</span>
          </p>
          <iframe
            title="Email sent"
            srcDoc={email.html}
            sandbox=""
            className="h-[32rem] w-full rounded-lg border bg-white"
          />
        </AdminSection>
      </div>
    </>
  );
}
