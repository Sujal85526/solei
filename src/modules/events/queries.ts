import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import { parseDailyHours, type EventStatus, type EventType } from "./schema";

const EVENT_DOCS_BUCKET = "event-docs";
/** Signed download links on the detail page stay valid this long. */
const SIGNED_URL_SECONDS = 60 * 60;

export type CalendarEvent = {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  start_date: string;
  end_date: string;
  location: string | null;
  emirate: string | null;
  closed_at: string | null;
  daily_hours: unknown;
};

export type CalendarFilters = { status?: EventStatus[]; type?: EventType[] };

/** Events intersecting `[start, end]` (inclusive). */
export async function listEvents(
  range: { start: string; end: string },
  filters: CalendarFilters = {},
): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select(
      "id, name, type, status, start_date, end_date, location, emirate, closed_at, daily_hours",
    )
    .lte("start_date", range.end)
    .gte("end_date", range.start)
    .order("start_date")
    .order("name")
    .limit(500);
  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.type?.length) q = q.in("type", filters.type);
  return must(await q, "events");
}

export async function getEvent(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...data, daily_hours: parseDailyHours(data.daily_hours) };
}
export type EventRecord = NonNullable<Awaited<ReturnType<typeof getEvent>>>;

export async function findOverlaps(input: {
  startDate: string;
  endDate: string;
  excludeId?: string;
  location?: string;
}) {
  const supabase = await createClient();
  return must(
    await supabase.rpc("overlapping_events", {
      p_start: input.startDate,
      p_end: input.endDate,
      p_exclude: input.excludeId,
      p_location: input.location || undefined,
    }),
    "overlaps",
  );
}
export type Overlap = Awaited<ReturnType<typeof findOverlaps>>[number];

/** Everyone who can be put on an event (names only; see `event_staff_options`). */
export async function staffOptions() {
  const supabase = await createClient();
  const rows = must(await supabase.rpc("event_staff_options"), "staff options");
  return rows.map((r) => ({ ...r, position: r.position as string | null }));
}

export async function listEventStaff(eventId: string) {
  const supabase = await createClient();
  const [rows, people] = await Promise.all([
    supabase
      .from("event_staff")
      .select("id, user_id, role, note, created_at")
      .eq("event_id", eventId)
      .order("created_at"),
    staffOptions(),
  ]);
  const byId = new Map(people.map((p) => [p.user_id, p]));
  return must(rows, "event staff").map((r) => ({
    ...r,
    name: byId.get(r.user_id)?.full_name ?? "Former staff",
    position: byId.get(r.user_id)?.position ?? null,
  }));
}

/** Expenses with signed receipt links. Callers must check `reports.financial.view` (RLS does too). */
export async function listExpenses(eventId: string) {
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("event_expenses")
      .select("id, category, amount_fils, note, receipt_path, incurred_on, created_at")
      .eq("event_id", eventId)
      .order("incurred_on")
      .order("created_at"),
    "expenses",
  );
  const urls = await signedUrls(rows.map((r) => r.receipt_path).filter(Boolean) as string[]);
  return rows.map((r) => ({ ...r, receiptUrl: r.receipt_path ? urls.get(r.receipt_path) : null }));
}

export async function listDocuments(eventId: string) {
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("event_documents")
      .select("id, name, storage_path, mime, size_bytes, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    "documents",
  );
  const urls = await signedUrls(
    rows.map((r) => r.storage_path),
    true,
  );
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null }));
}

async function signedUrls(paths: string[], download = false) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(EVENT_DOCS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS, download ? { download: true } : undefined);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}

export type EventStockRow = {
  variantId: string;
  label: string;
  sku: string;
  allocated: number;
  sold: number;
  returned: number;
  damaged: number;
  other: number;
  remaining: number;
};

/** Per-variant allocated / sold / returned / broken / remaining at the event's location. */
export async function eventStock(eventId: string): Promise<{
  locationId: string | null;
  rows: EventStockRow[];
}> {
  const supabase = await createClient();
  const [loc, summary] = await Promise.all([
    supabase.from("stock_locations").select("id").eq("event_id", eventId).maybeSingle(),
    supabase
      .from("event_stock_summary")
      .select(
        "variant_id, allocated, sold, returned, damaged, other, remaining, product_variants(sku, label, products(name, sort))",
      )
      .eq("event_id", eventId),
  ]);
  const rows = must(summary, "event stock")
    .map((r) => ({
      variantId: r.variant_id ?? "",
      label: `${r.product_variants?.products?.name ?? ""}${r.product_variants?.label ? ` · ${r.product_variants.label}` : ""}`,
      sku: r.product_variants?.sku ?? "",
      sort: r.product_variants?.products?.sort ?? 0,
      allocated: r.allocated ?? 0,
      sold: r.sold ?? 0,
      returned: r.returned ?? 0,
      damaged: r.damaged ?? 0,
      other: r.other ?? 0,
      remaining: r.remaining ?? 0,
    }))
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return { locationId: loc.data?.id ?? null, rows };
}

/** Active variants with what's available in main stock (for the allocation form). */
export async function allocationOptions() {
  const supabase = await createClient();
  const [main, variants] = await Promise.all([
    supabase.from("stock_locations").select("id, name").eq("is_default", true).maybeSingle(),
    supabase
      .from("product_variants")
      .select("id, label, sku, products(name, sort, active)")
      .eq("active", true)
      .order("sku"),
  ]);
  const mainLoc = main.data;
  const levels = mainLoc
    ? must(
        await supabase
          .from("stock_levels")
          .select("variant_id, on_hand")
          .eq("location_id", mainLoc.id),
        "main stock",
      )
    : [];
  const onHand = new Map(levels.map((l) => [l.variant_id, l.on_hand ?? 0]));
  const options = must(variants, "variants")
    .map((v) => ({
      id: v.id,
      label: `${v.products?.name ?? ""}${v.label ? ` · ${v.label}` : ""}`,
      sku: v.sku,
      available: onHand.get(v.id) ?? 0,
      sort: v.products?.sort ?? 0,
    }))
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  return { main: mainLoc, options };
}

export async function warehouseOptions() {
  const supabase = await createClient();
  return must(
    await supabase
      .from("stock_locations")
      .select("id, name, is_default")
      .neq("kind", "event")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("name"),
    "warehouses",
  );
}
