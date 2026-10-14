import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/catalog/product-form";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories, listDestinations } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePagePermission("catalog.manage");
  const [categories, destinations] = await Promise.all([listCategories(), listDestinations()]);
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Products
      </Link>
      <PageHeader
        title="New product"
        description="Add the details first — sizes, prices and photos come next."
      />
      <AdminSection>
        <ProductForm categories={categories} destinations={destinations} />
      </AdminSection>
    </div>
  );
}
