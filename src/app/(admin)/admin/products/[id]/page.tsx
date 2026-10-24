import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ImageManager } from "@/components/admin/catalog/image-manager";
import { OptionsEditor } from "@/components/admin/catalog/options-editor";
import { ProductForm } from "@/components/admin/catalog/product-form";
import { VariantsEditor } from "@/components/admin/catalog/variants-editor";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { setProductActiveAction } from "@/modules/catalog/actions";
import {
  getProduct,
  listCategories,
  listDestinations,
  onHandByVariant,
} from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const staff = await requirePagePermission("catalog.view");
  const { id } = await params;
  const [product, categories, destinations, stock] = await Promise.all([
    getProduct(id),
    listCategories(),
    listDestinations(),
    onHandByVariant(),
  ]);
  if (!product) notFound();
  const canManage = can(staff.permissions, "catalog.manage");
  const canSeeCost = can(staff.permissions, "reports.financial.view");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href="/admin/products"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Products
      </Link>
      <PageHeader
        title={product.name}
        description={
          product.active ? (
            <Badge variant="success">Live in the shop</Badge>
          ) : (
            <Badge variant="muted">Hidden</Badge>
          )
        }
        actions={
          <>
            <Link
              href={`/products/${product.slug}`}
              target="_blank"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink /> View in shop
            </Link>
            {canManage ? (
              <ConfirmButton
                title={product.active ? "Hide this product?" : "Publish this product?"}
                description={
                  product.active
                    ? "It disappears from the shop. Orders and stock history are kept."
                    : "It appears in the shop for customers."
                }
                confirmLabel={product.active ? "Hide" : "Publish"}
                action={setProductActiveAction.bind(null, product.id, !product.active)}
              >
                {product.active ? "Hide" : "Publish"}
              </ConfirmButton>
            ) : null}
          </>
        }
      />
      <AdminSection title="Sizes & prices" description="Each size is a separate stock unit.">
        {canManage ? (
          <VariantsEditor
            productId={product.id}
            canSeeCost={canSeeCost}
            variants={product.product_variants.map((v) => ({
              ...v,
              cost_fils: canSeeCost ? (v.variant_costs?.cost_fils ?? null) : null,
              onHand: stock.get(v.id) ?? 0,
            }))}
          />
        ) : (
          <p className="text-muted-foreground text-sm">You can view but not edit variants.</p>
        )}
      </AdminSection>
      <AdminSection
        title="Customisation"
        description="For giveaways: choices the customer makes (ribbon, box, a name on the tag) and the minimum per order."
      >
        <OptionsEditor
          productId={product.id}
          groups={product.product_option_groups}
          minOrderQty={product.min_order_qty}
          canManage={canManage}
        />
      </AdminSection>
      <AdminSection title="Photos">
        {canManage ? (
          <ImageManager
            productId={product.id}
            productName={product.name}
            images={product.product_images}
          />
        ) : null}
      </AdminSection>
      <AdminSection title="Details">
        {canManage ? (
          <ProductForm product={product} categories={categories} destinations={destinations} />
        ) : (
          <p className="text-sm">{product.description}</p>
        )}
      </AdminSection>
    </div>
  );
}
