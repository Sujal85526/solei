import type { Metadata } from "next";
import Link from "next/link";
import { CampaignEditor } from "@/components/admin/campaigns/campaign-editor";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listSegments } from "@/modules/campaigns/queries";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const staff = await requirePagePermission("marketing.manage");
  const segments = await listSegments();
  return (
    <>
      <PageHeader
        title="New campaign"
        description={
          <>
            <Link href="/admin/campaigns" className="underline underline-offset-4">
              Campaigns
            </Link>{" "}
            · Saved as a draft; nothing is sent until you press Send.
          </>
        }
      />
      <CampaignEditor
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
