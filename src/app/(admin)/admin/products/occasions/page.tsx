import type { Metadata } from "next";
import { CatalogTabs } from "@/components/admin/catalog/catalog-tabs";
import { OccasionsEditor } from "@/components/admin/catalog/occasions-editor";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listOccasionsAdmin } from "@/modules/giveaways/admin-queries";

export const metadata: Metadata = { title: "Occasions" };

export default async function OccasionsPage() {
  await requirePagePermission("catalog.manage");
  const occasions = await listOccasionsAdmin();
  return (
    <>
      <PageHeader
        title="Products"
        description="Occasions on the Giveaways page — each with a photo and a line of text. Choose a giveaway's occasions on the product."
      />
      <CatalogTabs />
      <OccasionsEditor occasions={occasions} />
    </>
  );
}
