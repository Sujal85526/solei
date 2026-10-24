import "server-only";
import { publicEnv } from "@/lib/env";
import { formatAED } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/modules/notifications/service";
import { getGiftCardSettings } from "./queries";
import { expiryText } from "./schema";

/*
 * Gift card emails. Like the order emails, these swallow their own errors (logged) so a broken
 * email never breaks the payment that triggered it.
 */

type CardForEmail = {
  id: string;
  code: string;
  initial_fils: number;
  expires_at: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  sender_name: string | null;
  message: string | null;
  buyer_customer_id: string | null;
};

const CARD_FIELDS =
  "id, code, initial_fils, expires_at, recipient_name, recipient_email, sender_name, message, buyer_customer_id";

/** Email the card itself to `to` and mark it sent. Deduped per card unless `resend`. */
async function deliver(
  card: CardForEmail,
  to: string,
  fallback: { name: string | null; from: string | null; orderId?: string },
  resend = false,
) {
  const settings = await getGiftCardSettings();
  const result = await notify("gift_card_delivered", {
    to,
    customerId: card.buyer_customer_id,
    orderId: fallback.orderId ?? null,
    dedupeKey: resend ? undefined : `gift_card:${card.id}`,
    dedupeHours: resend ? undefined : 24 * 365,
    vars: {
      recipient_name: card.recipient_name || fallback.name || "there",
      sender_name: card.sender_name || fallback.from || "Solei",
      amount: formatAED(card.initial_fils),
      message: card.message ? `“${card.message.replace(/\s+/g, " ")}”` : "",
      code: card.code,
      expiry: expiryText(card.expires_at),
      at_pop_ups: settings.atPos ? " or at any Solei pop-up" : "",
      shop_link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/shop`,
    },
  });
  if (result.status === "sent") {
    await createAdminClient()
      .from("gift_cards")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", card.id);
  }
  return result;
}

/**
 * A paid gift card purchase: each card goes to its recipient (or the buyer when it's for them),
 * and the buyer gets a receipt when it went to someone else.
 */
export async function notifyGiftCardPurchase(order: {
  id: string;
  number: string;
  contact_name: string | null;
  contact_email: string | null;
  customer_id: string | null;
}) {
  try {
    const { data: cards, error } = await createAdminClient()
      .from("gift_cards")
      .select(CARD_FIELDS)
      .eq("purchase_order_id", order.id)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    const buyerName = order.contact_name?.trim() || null;
    for (const card of cards) {
      const to = card.recipient_email || order.contact_email;
      if (!to) continue;
      await deliver(card, to, { name: buyerName, from: buyerName, orderId: order.id });
      if (card.recipient_email && order.contact_email) {
        await notify("gift_card_purchased", {
          to: order.contact_email,
          customerId: order.customer_id,
          orderId: order.id,
          dedupeKey: `gift_card_receipt:${card.id}`,
          dedupeHours: 24 * 365,
          vars: {
            customer_name: buyerName || "there",
            amount: formatAED(card.initial_fils),
            order_number: order.number,
            recipient: card.recipient_name
              ? `${card.recipient_name} (${card.recipient_email})`
              : card.recipient_email,
          },
        });
      }
    }
  } catch (e) {
    console.error("gift card notification failed", e);
  }
}

/** Staff-issued card, or "Resend" from the admin: email it to its recipient. */
export async function sendGiftCard(cardId: string, { resend = false } = {}) {
  const { data: card, error } = await createAdminClient()
    .from("gift_cards")
    .select(CARD_FIELDS)
    .eq("id", cardId)
    .single();
  if (error) throw new Error(error.message);
  if (!card.recipient_email) return { status: "skipped" as const, reason: "no email" };
  return deliver(card, card.recipient_email, { name: null, from: null }, resend);
}
