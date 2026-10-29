import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { startPayment } from "@/modules/checkout/service";
import { paymentProvider } from "@/providers/payment";
import { computeEstimate } from "./estimate";
import { fallbackBookingConfig } from "./fallback";
import {
  notifyBookingConfirmed,
  notifyBookingReceived,
  notifyQuoteSent,
  quoteUrl,
  sendBookingMessage,
} from "./notify";
import {
  bookingRequestSchema,
  bookingSettingsSchema,
  configSchemas,
  estimatePreviewSchema,
  messageSchema,
  paymentRequestSchema,
  sendQuoteSchema,
  statusChangeSchema,
  toSubmitPayload,
  type ConfigKind,
} from "./schema";
import type { Estimate, EstimateLine } from "./types";
import { waLink, waTexts } from "./whatsapp";

type DbError = { message: string; code?: string };

/** Map Postgres errors to safe messages (RPCs raise P0001 with customer-friendly text). */
function dbError(error: DbError): never {
  if (error.code === "P0001" || error.code === "P0002") {
    const m = error.message;
    throw new UserError(m.charAt(0).toUpperCase() + m.slice(1) + (m.endsWith(".") ? "" : "."));
  }
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "23503")
    throw new UserError("This option is used by existing bookings — deactivate it instead.");
  throw new Error(error.message);
}

type RawEstimate = {
  lines: {
    kind: EstimateLine["kind"];
    label: string;
    qty: number;
    category?: string;
    unit_price_fils: number | null;
    total_fils: number | null;
  }[];
  total_fils: number;
};

const fromRaw = (raw: RawEstimate): Estimate => ({
  totalFils: raw.total_fils,
  lines: raw.lines.map((l) => ({
    kind: l.kind,
    label: l.label,
    qty: l.qty,
    category: l.category,
    unitPriceFils: l.unit_price_fils,
    totalFils: l.total_fils,
  })),
});

// ─── Public ─────────────────────────────────────────────────────────────────────────────────

/** Server-computed estimate for the summary step (the same function submit uses). */
export async function previewEstimate(input: unknown): Promise<Estimate> {
  const v = estimatePreviewSchema.parse(input);
  if (process.env.CONTENT_FALLBACK === "1") {
    return computeEstimate({ ...v, productsInterest: v.products }, fallbackBookingConfig());
  }
  const { data, error } = await createPublicClient().rpc("booking_estimate", {
    p: {
      package_id: v.packageId,
      flowers: v.flowers,
      flower_option_id: v.flowerOptionId,
      products_interest: v.products,
    },
  });
  if (error) dbError(error);
  return fromRaw(data as unknown as RawEstimate);
}

/** Submit a request as a visitor (anon RPC); acknowledgement + owner alert follow. */
export async function submitBooking(input: unknown) {
  const v = bookingRequestSchema.parse(input);
  const { data, error } = await createPublicClient()
    .rpc("submit_booking", { p: toSubmitPayload(v) })
    .single();
  if (error) dbError(error);
  if (!data.existing) await notifyBookingReceived(data.booking_id);
  return { ref: data.ref, estimatedTotalFils: data.estimated_total_fils };
}

export type PublicQuote = {
  ref: string;
  booking_status: string;
  customer_name: string;
  event_type: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  emirate: string;
  guests: number;
  version: number;
  status: "sent" | "accepted" | "superseded" | "withdrawn";
  is_latest: boolean;
  expired: boolean;
  lines: { label: string; qty: number; unit_price_fils: number; total_fils: number }[];
  subtotal_fils: number;
  discount_fils: number;
  total_fils: number;
  deposit_fils: number;
  valid_until: string;
  notes: string | null;
  sent_at: string;
  accepted_at: string | null;
  paid_fils: number;
};

const TOKEN = /^[0-9a-f]{64}$/;

export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  if (!TOKEN.test(token)) return null;
  const { data, error } = await createPublicClient().rpc("get_booking_quote", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as unknown as PublicQuote | null) ?? null;
}

/** The orders (deposit / balance) of the booking behind a quote link. */
export async function quoteOrderIds(token: string): Promise<string[]> {
  if (!TOKEN.test(token)) return [];
  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("booking_quotes")
    .select("booking_id")
    .eq("token", token)
    .maybeSingle();
  if (!quote) return [];
  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("booking_id", quote.booking_id);
  return (orders ?? []).map((o) => o.id);
}

export async function acceptQuote(token: string) {
  if (!TOKEN.test(token)) throw new UserError("Quotation not found.");
  const { data, error } = await createPublicClient()
    .rpc("accept_quote", { p_token: token })
    .single();
  if (error) dbError(error);
  if (data.status === "confirmed") await notifyBookingIdConfirmedByToken(token);
  return data;
}

async function notifyBookingIdConfirmedByToken(token: string) {
  const { data } = await createAdminClient()
    .from("booking_quotes")
    .select("booking_id")
    .eq("token", token)
    .single();
  if (data) await notifyBookingConfirmed(data.booking_id);
}

/** Customer pays the deposit or the remaining balance from the quote page. */
export async function startQuotePayment(token: string, kind: "deposit" | "balance") {
  if (!TOKEN.test(token)) throw new UserError("Quotation not found.");
  const { data: orderId, error } = await createPublicClient().rpc("quote_payment_order", {
    p_token: token,
    p_kind: kind,
  });
  if (error) dbError(error);
  const back = quoteUrl(token);
  return startPayment(orderId, {
    successUrl: `${back}?paid=1`,
    cancelUrl: `${back}?cancelled=1`,
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────────────────────────

export async function changeStatus(input: unknown) {
  await assertPermission("bookings.manage");
  const v = statusChangeSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_booking_status", {
    p_booking_id: v.bookingId,
    p_status: v.status,
    p_reason: v.reason || undefined,
  });
  if (error) dbError(error);
}

export async function confirmBooking(bookingId: string) {
  await assertPermission("bookings.manage");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_booking", { p_booking_id: bookingId });
  if (error) dbError(error);
  await notifyBookingConfirmed(bookingId);
  return { eventId: data };
}

async function logMessage(
  bookingId: string,
  direction: "out" | "note",
  channel: "email" | "whatsapp_link" | "internal",
  body: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_messages")
    .insert({ booking_id: bookingId, direction, channel, body });
  if (error) dbError(error);
}

export async function sendQuote(input: unknown) {
  await assertPermission("bookings.manage");
  const v = sendQuoteSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("send_booking_quote", {
      p: {
        booking_id: v.bookingId,
        lines: v.lines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unit_price_fils: l.unitPriceFils,
        })),
        discount_fils: v.discountFils,
        deposit_fils: v.depositFils,
        valid_until: v.validUntil,
        notes: v.notes,
      },
    })
    .single();
  if (error) dbError(error);
  let emailed = false;
  if (v.sendEmail) {
    const r = await notifyQuoteSent(v.bookingId, data.token, data.total_fils);
    emailed = r.status === "sent";
  }
  await logMessage(
    v.bookingId,
    "out",
    v.sendEmail ? "email" : "internal",
    `Quotation v${data.version} ${v.sendEmail ? (emailed ? "emailed" : "prepared (email not sent)") : "prepared"}.`,
  );
  return { ...data, link: quoteUrl(data.token), emailed };
}

/** Internal note, email to the customer, or a logged WhatsApp click-to-chat link. */
export async function addMessage(input: unknown) {
  await assertPermission("bookings.manage");
  const v = messageSchema.parse(input);
  if (v.kind === "note") {
    await logMessage(v.bookingId, "note", "internal", v.body);
    return { whatsappUrl: null, emailed: false };
  }
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("contact_phone")
    .eq("id", v.bookingId)
    .single();
  if (!b) throw new UserError("Booking not found.");
  if (v.kind === "email") {
    const r = await sendBookingMessage(v.bookingId, v.body);
    await logMessage(v.bookingId, "out", "email", v.body);
    return { whatsappUrl: null, emailed: r.status === "sent" };
  }
  await logMessage(v.bookingId, "out", "whatsapp_link", v.body);
  return { whatsappUrl: waLink(b.contact_phone, v.body), emailed: false };
}

/**
 * Hosted payment link for the deposit or the balance: a 'booking' order in the sales ledger +
 * a provider checkout session, recorded in payment_links. Returns WhatsApp share text too.
 */
export async function createPaymentLink(input: unknown) {
  const staff = await assertPermission("bookings.manage");
  const v = paymentRequestSchema.parse(input);
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("booking_payment_order", {
    p_booking_id: v.bookingId,
    p_kind: v.kind,
  });
  if (error) dbError(error);

  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("booking_quotes")
    .select("token")
    .eq("booking_id", v.bookingId)
    .in("status", ["sent", "accepted"])
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const back = quote ? quoteUrl(quote.token) : undefined;
  const url = await startPayment(orderId, {
    successUrl: back ? `${back}?paid=1` : undefined,
    cancelUrl: back ? `${back}?cancelled=1` : undefined,
  });

  const [{ data: order }, { data: payment }, { data: booking }] = await Promise.all([
    admin.from("orders").select("total_fils").eq("id", orderId).single(),
    admin
      .from("payments")
      .select("provider_ref, provider_payload")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("bookings")
      .select("ref, contact_name, contact_phone")
      .eq("id", v.bookingId)
      .single(),
  ]);
  const amount = order?.total_fils ?? 0;
  const expires = (payment?.provider_payload as { expires_at?: string } | null)?.expires_at;
  await admin.from("payment_links").insert({
    order_id: orderId,
    booking_id: v.bookingId,
    amount_fils: amount,
    description: `${booking?.ref} ${v.kind}`,
    provider: paymentProvider().name,
    provider_id: payment?.provider_ref ?? null,
    url,
    expires_at: expires ?? null,
    created_by: staff.userId,
  });
  const label = v.kind === "deposit" ? "deposit" : "remaining balance";
  await logMessage(v.bookingId, "note", "internal", `Payment link created for the ${label}.`);
  return {
    url,
    amountFils: amount,
    whatsappUrl: booking
      ? waLink(
          booking.contact_phone,
          waTexts.payment(booking.contact_name, booking.ref, amount, label, url),
        )
      : null,
  };
}

// ─── Config ─────────────────────────────────────────────────────────────────────────────────

const CONFIG_TABLES = {
  eventType: "booking_event_types",
  service: "booking_service_types",
  package: "booking_packages",
  booth: "booth_designs",
  flower: "flower_options",
} as const;

function configRow(kind: ConfigKind, input: unknown) {
  switch (kind) {
    case "eventType": {
      const v = configSchemas.eventType.parse(input);
      return { id: v.id, row: { name: v.name, sort: v.sort, active: v.active } };
    }
    case "service": {
      const v = configSchemas.service.parse(input);
      const row = { name: v.name, sort: v.sort, active: v.active, description: v.description };
      return { id: v.id, row: { ...row, description: row.description || null } };
    }
    case "package": {
      const v = configSchemas.package.parse(input);
      return {
        id: v.id,
        row: {
          name: v.name,
          sort: v.sort,
          active: v.active,
          description: v.description || null,
          inclusions: v.inclusions,
          base_price_fils: v.basePrice,
          images: v.images,
        },
      };
    }
    case "booth": {
      const v = configSchemas.booth.parse(input);
      return {
        id: v.id,
        row: {
          name: v.name,
          sort: v.sort,
          active: v.active,
          description: v.description || null,
          photos: v.photos,
        },
      };
    }
    case "flower": {
      const v = configSchemas.flower.parse(input);
      return {
        id: v.id,
        row: { name: v.name, sort: v.sort, active: v.active, hex: v.hex, price_fils: v.price },
      };
    }
  }
}

export async function saveConfig(kind: ConfigKind, input: unknown) {
  await assertPermission("bookings.manage");
  const { id, row } = configRow(kind, input);
  const supabase = await createClient();
  const table = supabase.from(CONFIG_TABLES[kind]);
  const { error } = id
    ? await table.update(row as never).eq("id", id)
    : await table.insert(row as never);
  if (error) dbError(error);
}

export async function deleteConfig(kind: ConfigKind, id: string) {
  await assertPermission("bookings.manage");
  const supabase = await createClient();
  const { error } = await supabase.from(CONFIG_TABLES[kind]).delete().eq("id", id);
  if (error) dbError(error);
}

export async function saveBookingSettings(input: unknown) {
  await assertPermission("bookings.manage");
  const v = bookingSettingsSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_booking_settings", {
    p_deposit_bp: v.depositPercent,
    p_flower_base_fils: v.flowerBase,
    p_quote_validity_days: v.validityDays,
  });
  if (error) dbError(error);
}
