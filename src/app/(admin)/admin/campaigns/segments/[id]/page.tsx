import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SegmentForm } from "@/components/admin/campaigns/segment-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { destinationOptions, getSegment } from "@/modules/campaigns/queries";

export const metadata: Metadata = { title: "Segment" };

export default async function SegmentPage({ params }: PageProps<"/admin/campaigns/segments/[id]">) {
  await requirePagePermission("marketing.manage");
  const { id } = await params;
  const [segment, destinations] = await Promise.all([getSegment(id), destinationOptions()]);
  if (!segment) notFound();
  return (
    <>
      <PageHeader
        title={segment.name}
        description={
          <>
            <Link href="/admin/campaigns" className="underline underline-offset-4">
              Campaigns
            </Link>{" "}
            · Segment
          </>
        }
      />
      <SegmentForm key={segment.updatedAt} segment={segment} destinations={destinations} />
    </>
  );
}
