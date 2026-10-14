import "server-only";
import { businessDay } from "@/lib/dates";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";

export type PosEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  today: boolean;
  closed: boolean;
};
export type PosProduct = {
  variantId: string;
  name: string;
  destination: string | null;
  category: string;
  label: string;
  priceFils: number;
  image: string | null;
  stock: number;
};
export type DaySummary = {
  orders: number;
  units: number;
  revenue_fils: number;
  by_method: Record<string, number>;
};

/** Events you can sell at: confirmed (or potential) events running today first, then upcoming/recent. */
export async function posEvents(now = new Date()): Promise<PosEvent[]> {
  const supabase = await createClient();
  const today = businessDay(now);
  const rows = must(
    await supabase
      .from("events")
      .select("id, name, start_date, end_date, status, closed_at")
      .in("status", ["confirmed", "potential"])
      .order("start_date", { ascending: true }),
    "events",
  );
  return rows
    .map((e) => ({
      id: e.id,
      name: e.name,
      startDate: e.start_date,
      endDate: e.end_date,
      status: e.status,
      today: e.start_date <= today && today <= e.end_date,
      closed: Boolean(e.closed_at),
    }))
    .sort((a, b) => Number(b.today) - Number(a.today) || a.startDate.localeCompare(b.startDate));
}

/** Tiles: every active variant with its stock at this event's location. */
export async function posProducts(eventId: string): Promise<PosProduct[]> {
  const supabase = await createClient();
  const { data: loc } = await supabase
    .from("stock_locations")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();
  const [variants, levels] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id, label, price_fils, products!inner(name, active, sort, categories(name), destinations(name), product_images(url, sort))",
      )
      .eq("active", true)
      .eq("products.active", true),
    loc
      ? supabase.from("stock_levels").select("variant_id, on_hand").eq("location_id", loc.id)
      : Promise.resolve({ data: [] as { variant_id: string | null; on_hand: number | null }[] }),
  ]);
  const stock = new Map((levels.data ?? []).map((l) => [l.variant_id, l.on_hand ?? 0]));
  return must(variants, "variants")
    .map((v) => ({
      variantId: v.id,
      name: v.products.name,
      destination: v.products.destinations?.name ?? null,
      category: v.products.categories?.name ?? "",
      label: v.label,
      priceFils: v.price_fils,
      image: [...(v.products.product_images ?? [])].sort((a, b) => a.sort - b.sort)[0]?.url ?? null,
      stock: stock.get(v.id) ?? 0,
      sort: v.products.sort,
    }))
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.sort - b.sort)
    .map(({ sort: _s, ...p }) => p);
}

export async function daySummary(eventId: string): Promise<DaySummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("pos_day_summary", { p_event_id: eventId });
  return (data as DaySummary | null) ?? { orders: 0, units: 0, revenue_fils: 0, by_method: {} };
}
