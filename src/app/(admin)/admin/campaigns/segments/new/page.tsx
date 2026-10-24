import type { Metadata } from "next";
import Link from "next/link";
import { SegmentForm } from "@/components/admin/campaigns/segment-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { destinationOptions } from "@/modules/campaigns/queries";

export const metadata: Metadata = { title: "New segment" };

export default async function NewSegmentPage() {
  await requirePagePermission("marketing.manage");
  const destinations = await destinationOptions();
  return (
    <>
      <PageHeader
        title="New segment"
        description={
          <>
            <Link href="/admin/campaigns" className="underline underline-offset-4">
              Campaigns
            </Link>{" "}
            · A saved group of customers to send campaigns to.
          </>
        }
      />
      <SegmentForm destinations={destinations} />
    </>
  );
}
