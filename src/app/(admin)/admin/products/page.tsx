import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { CatalogTabs } from "@/components/admin/catalog/catalog-tabs";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { listCategories, listProducts } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Products" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const staff = await requirePagePermission("catalog.view");
  const sp = await searchParams;
  const status = str(sp.status);
  const filters = {
    q: str(sp.q),
    category: str(sp.category),
    status: status === "active" || status === "inactive" ? status : undefined,
  } as const;
  const [products, categories] = await Promise.all([listProducts(filters), listCategories()]);
  const canManage = can(staff.permissions, "catalog.manage");

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.length} product${products.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <Link href="/admin/products/new" className={buttonVariants()}>
              <Plus /> New product
            </Link>
          ) : null
        }
      />
      <CatalogTabs />
      <form method="get" className="mb-5 grid gap-2 sm:grid-cols-[1fr_12rem_10rem_auto]">
        <Input
          name="q"
          defaultValue={filters.q}
          placeholder="Search products"
          aria-label="Search products"
        />
        <NativeSelect name="category" defaultValue={filters.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Live</option>
          <option value="inactive">Hidden</option>
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const prices = p.product_variants.filter((v) => v.active).map((v) => v.price_fils);
          const cover = p.product_images[0];
          return (
            <li key={p.id}>
              <Link
                href={`/admin/products/${p.id}`}
                className="bg-card hover:border-burgundy/40 flex items-center gap-4 rounded-xl border p-3 transition-colors"
              >
                <span className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
                    <img src={cover.url} alt="" className="size-full object-cover" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                    {!p.active ? <Badge variant="muted">Hidden</Badge> : null}
                    {p.featured ? <Badge variant="pink">Featured</Badge> : null}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {p.categories?.name}
                    {p.destinations ? ` · ${p.destinations.name}` : ""}
                  </span>
                  <span className="numeric mt-1 flex gap-3 text-sm">
                    <span>{prices.length ? formatAED(Math.min(...prices)) : "No price"}</span>
                    <span className={p.onHand <= 5 ? "text-[#8A5108]" : "text-muted-foreground"}>
                      {p.onHand} in stock
                    </span>
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
              </Link>
            </li>
          );
        })}
      </ul>
      {products.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">No products match.</p>
      ) : null}
    </>
  );
}
