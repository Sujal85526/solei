import type { Metadata } from "next";
import { CatalogTabs } from "@/components/admin/catalog/catalog-tabs";
import { DestinationsEditor } from "@/components/admin/catalog/taxonomy-editors";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listDestinations } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Destinations" };

export default async function DestinationsPage() {
  await requirePagePermission("catalog.manage");
  const destinations = await listDestinations();
  return (
    <>
      <PageHeader
        title="Products"
        description="Each destination has its story, colour and passport stamp."
      />
      <CatalogTabs />
      <DestinationsEditor destinations={destinations} />
    </>
  );
}
