import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyBookingConfirmed } from "./notify";

/**
 * Called by the payment webhook after an order became fully paid. The database already confirmed
 * the booking (trigger `booking_order_paid`); this sends the confirmation email. Never throws.
 */
export async function onBookingOrderPaid(orderId: string) {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("booking_id, channel")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.booking_id || order.channel !== "booking") return;
    const { data: booking } = await admin
      .from("bookings")
      .select("status")
      .eq("id", order.booking_id)
      .single();
    if (booking?.status === "confirmed") await notifyBookingConfirmed(order.booking_id);
  } catch (e) {
    console.error("booking payment follow-up failed", e);
  }
}
