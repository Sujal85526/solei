import type { Metadata } from "next";
import { CatalogTabs } from "@/components/admin/catalog/catalog-tabs";
import { CategoriesEditor } from "@/components/admin/catalog/taxonomy-editors";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePagePermission("catalog.manage");
  const categories = await listCategories();
  return (
    <>
      <PageHeader
        title="Products"
        description="Perfumes, all-over sprays, dukhoon — and anything you add later."
      />
      <CatalogTabs />
      <CategoriesEditor categories={categories} />
    </>
  );
}
