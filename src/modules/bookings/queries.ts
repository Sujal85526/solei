import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { must } from "@/lib/supabase/must";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import { fallbackBookingConfig } from "./fallback";
import type { BookingConfig, BookingStatus, Estimate, ProductInterest, QuoteLine } from "./types";

/** Cache tag for the public booking configuration (admin edits call updateTag). */
export const BOOKING_CONFIG_TAG = "booking-config";

const isFallback = () => process.env.CONTENT_FALLBACK === "1";

/** Public wizard configuration: active rows only (RLS), cached for hours. */
export async function getBookingConfig(): Promise<BookingConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag(BOOKING_CONFIG_TAG, CONTENT_TAGS.catalog, CONTENT_TAGS.settings);
  if (isFallback()) return fallbackBookingConfig();

  const db = createPublicClient();
  const [types, services, packages, booths, flowers, settings, categories] = await Promise.all([
    db.from("booking_event_types").select("id, name").eq("active", true).order("sort"),
    db
      .from("booking_service_types")
      .select("id, name, description")
      .eq("active", true)
      .order("sort"),
    db
      .from("booking_packages")
      .select("id, name, description, inclusions, base_price_fils, images")
      .eq("active", true)
      .order("sort"),
    db
      .from("booth_designs")
      .select("id, name, description, photos")
      .eq("active", true)
      .order("sort"),
    db.from("flower_options").select("id, name, hex, price_fils").eq("active", true).order("sort"),
    db.from("settings").select("booking_deposit_bp, booking_flower_base_fils").eq("id", 1).single(),
    db
      .from("categories")
      .select("slug, name, products(active, product_variants(price_fils, active))")
      .eq("active", true)
      .order("sort"),
  ]);

  const s = must(settings, "booking settings");
  return {
    eventTypes: must(types, "event types"),
    services: must(services, "services"),
    packages: must(packages, "packages").map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      inclusions: p.inclusions,
      basePriceFils: p.base_price_fils,
      images: p.images,
    })),
    booths: must(booths, "booths"),
    flowers: must(flowers, "flowers").map((f) => ({
      id: f.id,
      name: f.name,
      hex: f.hex,
      priceFils: f.price_fils,
    })),
    flowerBaseFils: s.booking_flower_base_fils,
    depositBp: s.booking_deposit_bp,
    products: must(categories, "categories").map((c) => {
      const prices = c.products
        .filter((p) => p.active)
        .flatMap((p) => p.product_variants.filter((v) => v.active).map((v) => v.price_fils));
      return {
        category: c.slug,
        name: c.name,
        fromPriceFils: prices.length ? Math.min(...prices) : null,
      };
    }),
  };
}

// ─── Admin (RLS: bookings.view) ──────────────────────────────────────────────────────────────

export const BOOKING_STATUSES: BookingStatus[] = [
  "requested",
  "in_review",
  "quoted",
  "accepted",
  "confirmed",
  "completed",
  "rejected",
  "cancelled",
];

export type BookingListRow = {
  id: string;
  ref: string;
  status: BookingStatus;
  contact_name: string;
  contact_phone: string;
  event_date: string;
  guests: number;
  emirate: string;
  location: string;
  estimated_total_fils: number;
  created_at: string;
  booking_event_types: { name: string } | null;
};

export async function listBookings(opts: { status?: BookingStatus | "open"; q?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("bookings")
    .select(
      "id, ref, status, contact_name, contact_phone, event_date, guests, emirate, location, estimated_total_fils, created_at, booking_event_types(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.status === "open") query = query.in("status", ["requested", "in_review"]);
  else if (opts.status) query = query.eq("status", opts.status);
  const q = opts.q?.trim().replace(/[%,()]/g, "");
  if (q) {
    query = query.or(
      `ref.ilike.%${q}%,contact_name.ilike.%${q}%,contact_phone.ilike.%${q}%,contact_email.ilike.%${q}%`,
    );
  }
  return must(await query, "bookings") as BookingListRow[];
}

export async function bookingStatusCounts(): Promise<Record<BookingStatus, number>> {
  const supabase = await createClient();
  const rows = must(await supabase.from("bookings").select("status"), "booking counts");
  const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<
    BookingStatus,
    number
  >;
  for (const r of rows) counts[r.status] += 1;
  return counts;
}

export type QuoteRow = {
  id: string;
  version: number;
  status: "sent" | "accepted" | "superseded" | "withdrawn";
  lines: QuoteLine[];
  subtotal_fils: number;
  discount_fils: number;
  total_fils: number;
  deposit_fils: number;
  valid_until: string;
  notes: string | null;
  token: string;
  sent_at: string;
  accepted_at: string | null;
};

type RawQuoteLine = { label: string; qty: number; unit_price_fils: number; total_fils: number };

export async function getBooking(id: string) {
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "*, booking_event_types(name), booking_packages(name, base_price_fils), booth_designs(name, photos), flower_options(name, hex)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`booking failed: ${error.message}`);
  if (!booking) return null;

  const [quotes, messages, services] = await Promise.all([
    supabase.from("booking_quotes").select("*").eq("booking_id", id).order("version", {
      ascending: false,
    }),
    supabase
      .from("booking_messages")
      .select("id, direction, channel, body, created_at, created_by")
      .eq("booking_id", id)
      .order("created_at", { ascending: false }),
    booking.service_type_ids.length
      ? supabase.from("booking_service_types").select("id, name").in("id", booking.service_type_ids)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);

  return {
    ...booking,
    products_interest: booking.products_interest as unknown as ProductInterest[],
    estimate: booking.estimate as unknown as {
      lines: {
        kind: string;
        label: string;
        qty: number;
        unit_price_fils: number | null;
        total_fils: number | null;
      }[];
      total_fils: number;
    },
    services: must(services, "services"),
    quotes: must(quotes, "quotes").map((q): QuoteRow => ({
      ...q,
      lines: (q.lines as unknown as RawQuoteLine[]).map((l) => ({
        label: l.label,
        qty: l.qty,
        unitPriceFils: l.unit_price_fils,
        totalFils: l.total_fils,
      })),
    })),
    messages: must(messages, "messages"),
  };
}

export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBooking>>>;

/** The stored estimate in the shape of the pure `Estimate` type. */
export function storedEstimate(b: BookingDetail): Estimate {
  return {
    totalFils: b.estimate?.total_fils ?? 0,
    lines: (b.estimate?.lines ?? []).map((l) => ({
      kind: l.kind as Estimate["lines"][number]["kind"],
      label: l.label,
      qty: l.qty,
      unitPriceFils: l.unit_price_fils,
      totalFils: l.total_fils,
    })),
  };
}

/**
 * Payment orders and other orders attached to a booking. Orders are behind orders.view, so this
 * reads with the service role after checking bookings.view.
 */
export async function bookingOrders(bookingId: string) {
  await assertPermission("bookings.view");
  const admin = createAdminClient();
  const orders = must(
    await admin
      .from("orders")
      .select("id, number, channel, status, total_fils, notes, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    "booking orders",
  );
  if (!orders.length) return [];
  const summaries = must(
    await admin
      .from("order_payment_summary")
      .select("order_id, paid_fils, refunded_fils, outstanding_fils, payment_status")
      .in(
        "order_id",
        orders.map((o) => o.id),
      ),
    "payment summary",
  );
  const byId = new Map(summaries.map((s) => [s.order_id, s]));
  return orders.map((o) => ({
    ...o,
    paidFils: byId.get(o.id)?.paid_fils ?? 0,
    refundedFils: byId.get(o.id)?.refunded_fils ?? 0,
    paymentStatus: byId.get(o.id)?.payment_status ?? "pending",
  }));
}

export async function getBookingSettings() {
  const supabase = await createClient();
  return must(
    await supabase
      .from("settings")
      .select(
        "booking_deposit_bp, booking_flower_base_fils, booking_quote_validity_days, whatsapp_number",
      )
      .eq("id", 1)
      .single(),
    "booking settings",
  );
}

/** All config rows including inactive ones (admin settings screen). */
export async function listBookingConfig() {
  const supabase = await createClient();
  const [types, services, packages, booths, flowers] = await Promise.all([
    supabase.from("booking_event_types").select("*").order("sort").order("name"),
    supabase.from("booking_service_types").select("*").order("sort").order("name"),
    supabase.from("booking_packages").select("*").order("sort").order("name"),
    supabase.from("booth_designs").select("*").order("sort").order("name"),
    supabase.from("flower_options").select("*").order("sort").order("name"),
  ]);
  return {
    eventTypes: must(types, "event types"),
    services: must(services, "services"),
    packages: must(packages, "packages"),
    booths: must(booths, "booths"),
    flowers: must(flowers, "flowers"),
  };
}
