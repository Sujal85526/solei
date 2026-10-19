import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import { isLowStock } from "./schema";

export async function listLocations({ includeInactive = false } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("stock_locations")
    .select(
      "id, name, kind, sells_online, is_default, active, event_id, events(status, start_date, end_date)",
    )
    .order("is_default", { ascending: false })
    .order("kind")
    .order("name");
  if (!includeInactive) q = q.eq("active", true);
  return must(await q, "locations");
}

export type StockRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  destination: string | null;
  active: boolean;
  threshold: number;
  byLocation: Record<string, number>;
  total: number;
  low: boolean;
  /** Product display order. */
  sort: number;
};

/** Variant × location matrix with low-stock flags (total across non-event locations). */
export async function stockMatrix(): Promise<{
  rows: StockRow[];
  locations: Awaited<ReturnType<typeof listLocations>>;
  defaultThreshold: number;
}> {
  const supabase = await createClient();
  const [variants, levels, locations, privateSettings] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id, label, sku, active, low_stock_threshold, products(id, name, sort, destinations(name))",
      )
      .order("sku"),
    fetchAllStockLevels(supabase),
    listLocations(),
    supabase.from("private_settings").select("low_stock_default").maybeSingle(),
  ]);
  const defaultThreshold = privateSettings.data?.low_stock_default ?? 5;
  const eventLocations = new Set(locations.filter((l) => l.kind === "event").map((l) => l.id));
  // Index levels by variant once (instead of scanning every level for every variant).
  const levelsByVariant = new Map<string, typeof levels>();
  for (const l of levels) {
    if (!l.variant_id) continue;
    const list = levelsByVariant.get(l.variant_id);
    if (list) list.push(l);
    else levelsByVariant.set(l.variant_id, [l]);
  }

  const rows = must(variants, "variants")
    .map((v) => {
      const byLocation: Record<string, number> = {};
      let total = 0;
      for (const l of levelsByVariant.get(v.id) ?? []) {
        if (!l.location_id) continue;
        byLocation[l.location_id] = l.on_hand ?? 0;
        if (!eventLocations.has(l.location_id)) total += l.on_hand ?? 0;
      }
      const threshold = v.low_stock_threshold ?? defaultThreshold;
      return {
        variantId: v.id,
        productId: v.products?.id ?? "",
        productName: v.products?.name ?? "",
        variantLabel: v.label,
        sku: v.sku,
        destination: v.products?.destinations?.name ?? null,
        active: v.active,
        threshold,
        byLocation,
        total,
        low: v.active && isLowStock(total, v.low_stock_threshold, defaultThreshold),
        sort: v.products?.sort ?? 0,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.productName.localeCompare(b.productName));
  return { rows, locations, defaultThreshold };
}

export type MovementFilters = { variant?: string; location?: string; type?: string; page?: number };
export const MOVEMENTS_PAGE_SIZE = 50;

export async function listMovements(filters: MovementFilters = {}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  let q = supabase
    .from("stock_movements")
    .select(
      "id, qty, type, reason, created_at, created_by, transfer_id, order_line_id, stock_locations(name), product_variants(sku, label, products(name))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * MOVEMENTS_PAGE_SIZE, page * MOVEMENTS_PAGE_SIZE - 1);
  if (filters.variant) q = q.eq("variant_id", filters.variant);
  if (filters.location) q = q.eq("location_id", filters.location);
  if (filters.type) q = q.eq("type", filters.type as never);
  const res = await q;
  return { rows: must(res, "movements"), total: res.count ?? 0, page };
}

export async function getVariantStock(variantId: string) {
  const supabase = await createClient();
  const [{ data: variant }, { data: levels }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, label, sku, price_fils, low_stock_threshold, active, products(id, name)")
      .eq("id", variantId)
      .maybeSingle(),
    supabase.from("stock_levels").select("location_id, on_hand").eq("variant_id", variantId),
  ]);
  if (!variant) return null;
  return { variant, levels: levels ?? [] };
}

/** Variant options for stock forms (active first). */
export async function variantOptions() {
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("product_variants")
      .select("id, label, sku, active, products(name, sort)")
      .order("sku"),
    "variants",
  );
  return rows
    .map((v) => ({
      id: v.id,
      label: `${v.products?.name ?? ""}${v.label ? ` · ${v.label}` : ""}`,
      sku: v.sku,
      active: v.active,
      sort: v.products?.sort ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.sort - b.sort || a.label.localeCompare(b.label),
    );
}

/**
 * Every stock level, read in pages of 1,000 (the API's per-request cap) so large catalogues with
 * many event locations are never silently truncated.
 */
async function fetchAllStockLevels(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGE = 1000;
  const all: { variant_id: string | null; location_id: string | null; on_hand: number | null }[] =
    [];
  for (let from = 0; ; from += PAGE) {
    const page = must(
      await supabase
        .from("stock_levels")
        .select("variant_id, location_id, on_hand")
        .order("variant_id")
        .order("location_id")
        .range(from, from + PAGE - 1),
      "stock levels",
    );
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}
