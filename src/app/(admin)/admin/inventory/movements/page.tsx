import type { Metadata } from "next";
import Link from "next/link";
import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { MovementsList } from "@/components/admin/inventory/movements-list";
import { PageHeader } from "@/components/admin/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import {
  MOVEMENTS_PAGE_SIZE,
  listLocations,
  listMovements,
  variantOptions,
} from "@/modules/inventory/queries";
import { movementTypeLabels } from "@/modules/inventory/schema";
import { staffDirectory } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Stock movements" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function MovementsPage({
  searchParams,
}: PageProps<"/admin/inventory/movements">) {
  await requirePagePermission("inventory.view");
  const sp = await searchParams;
  const filters = {
    variant: str(sp.variant),
    location: str(sp.location),
    type: str(sp.type),
    page: Number(str(sp.page) ?? 1) || 1,
  };
  const [{ rows, total, page }, variants, locations, people] = await Promise.all([
    listMovements(filters),
    variantOptions(),
    listLocations({ includeInactive: true }),
    staffDirectory(),
  ]);
  const pages = Math.max(1, Math.ceil(total / MOVEMENTS_PAGE_SIZE));
  const qs = (p: number) =>
    new URLSearchParams(
      Object.entries({ ...filters, page: String(p) }).filter(([, v]) => v) as [string, string][],
    ).toString();

  return (
    <>
      <PageHeader title="Inventory" description="The full stock ledger, newest first." />
      <InventoryTabs />
      <form method="get" className="mb-5 grid gap-2 sm:grid-cols-[1fr_12rem_11rem_auto]">
        <NativeSelect name="variant" defaultValue={filters.variant ?? ""} aria-label="Product">
          <option value="">All products</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="location" defaultValue={filters.location ?? ""} aria-label="Location">
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={filters.type ?? ""} aria-label="Type">
          <option value="">All types</option>
          {Object.entries(movementTypeLabels).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      <MovementsList rows={rows} people={people} />
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={`?${qs(page - 1)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page <= 1 && "pointer-events-none opacity-50",
            )}
          >
            Newer
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            href={`?${qs(page + 1)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page >= pages && "pointer-events-none opacity-50",
            )}
          >
            Older
          </Link>
        </nav>
      ) : null}
    </>
  );
}
