import "server-only";
import { publicEnv } from "@/lib/env";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/server";
import { notify, ownerEmail } from "@/modules/notifications/service";

/*
 * Booking emails (templates `booking_received`, `quote_sent`, `booking_confirmed`,
 * `owner_new_booking`, `booking_message`) through the notifications service (template, outbox,
 * allow-list). Never throws: an email problem must not break a submit, quote or payment.
 */

export type BookingEmail = {
  to: string | null | undefined;
  vars: Record<string, string>;
  customerId?: string | null;
  bookingId?: string | null;
  dedupeKey?: string;
  dedupeHours?: number;
};

export type SendResult = Awaited<ReturnType<typeof notify>>;

export async function sendBookingEmail(key: string, input: BookingEmail): Promise<SendResult> {
  try {
    return await notify(key, input);
  } catch (e) {
    console.error(`booking email ${key} failed`, e);
    return { status: "failed", reason: e instanceof Error ? e.message : String(e) };
  }
}

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL;
export const quoteUrl = (token: string) => `${site()}/events/quote/${token}`;
export const adminBookingUrl = (id: string) => `${site()}/admin/bookings/${id}`;

type BookingRef = {
  id: string;
  ref: string;
  contact_name: string;
  contact_email: string;
  customer_id: string | null;
  event_date: string;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const eventDate = (d: string) =>
  formatBusinessDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

const refs = (b: BookingRef) => ({
  to: b.contact_email,
  customerId: b.customer_id,
  bookingId: b.id,
});

async function loadBooking(id: string): Promise<BookingRef | null> {
  const { data } = await createAdminClient()
    .from("bookings")
    .select("id, ref, contact_name, contact_email, customer_id, event_date")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Acknowledgement to the customer + alert to the owner. */
export async function notifyBookingReceived(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  const vars = {
    customer_name: firstName(b.contact_name),
    booking_ref: b.ref,
    event_date: eventDate(b.event_date),
  };
  await sendBookingEmail("booking_received", { ...refs(b), vars, dedupeKey: b.id });
  const owner = await ownerEmail();
  if (owner) {
    await sendBookingEmail("owner_new_booking", {
      to: owner,
      bookingId: b.id,
      vars: { ...vars, customer_name: b.contact_name, admin_link: adminBookingUrl(b.id) },
      dedupeKey: b.id,
      dedupeHours: 24 * 365,
    });
  }
}

export async function notifyQuoteSent(bookingId: string, token: string, totalFils: number) {
  const b = await loadBooking(bookingId);
  if (!b) return { status: "skipped" } as SendResult;
  return sendBookingEmail("quote_sent", {
    ...refs(b),
    vars: {
      customer_name: firstName(b.contact_name),
      booking_ref: b.ref,
      quote_total: formatAED(totalFils),
      quote_link: quoteUrl(token),
    },
  });
}

export async function notifyBookingConfirmed(bookingId: string) {
  const b = await loadBooking(bookingId);
  if (!b) return;
  await sendBookingEmail("booking_confirmed", {
    ...refs(b),
    vars: {
      customer_name: firstName(b.contact_name),
      booking_ref: b.ref,
      event_date: eventDate(b.event_date),
    },
    dedupeKey: b.id,
    dedupeHours: 24 * 365,
  });
}

export async function sendBookingMessage(bookingId: string, message: string) {
  const b = await loadBooking(bookingId);
  if (!b) return { status: "skipped" } as SendResult;
  return sendBookingEmail("booking_message", {
    ...refs(b),
    vars: { customer_name: firstName(b.contact_name), booking_ref: b.ref, message },
  });
}
