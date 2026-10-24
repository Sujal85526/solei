import "server-only";
import { publicEnv } from "@/lib/env";
import { formatAED } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/server";
import { orderUrl } from "@/modules/checkout/service";
import { notifyGiftCardPurchase } from "@/modules/gift-cards/notify";
import { notifyPassportForOrder } from "@/modules/loyalty/notify";
import { notify, ownerEmail } from "@/modules/notifications/service";
import { formatOrderLines, humanize, trackingText } from "./format";
import { CHANNEL_LABELS, CUSTOMER_STATUS_TEMPLATES, type OrderStatus } from "./status";

/*
 * Order emails. Every function here swallows its own errors (logged): notifications must never
 * break the payment, status change or stock update that triggered them.
 */

const adminUrl = (path: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`;

/** Channels whose customers can open the guest order page (same rule as public tracking). */
const GUEST_LINK_CHANNELS = new Set(["website", "whatsapp", "direct", "payment_link"]);

async function loadOrder(orderId: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id, number, channel, status, gift_card_purchase, customer_id, contact_name, contact_email, contact_phone, total_fils, delivery_emirate, fulfilment, tracking_number, courier, order_lines(product_name, variant_label, qty, line_total_fils, is_reward, variant_id, options, created_at)",
    )
    .eq("id", orderId)
    .single();
  if (error || !order) throw new Error(`order ${orderId} not found: ${error?.message}`);
  const { data: summary } = await admin
    .from("order_payment_summary")
    .select("outstanding_fils")
    .eq("order_id", orderId)
    .single();
  const lines = [...order.order_lines].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ...order, lines, outstandingFils: summary?.outstanding_fils ?? 0 };
}
type LoadedOrder = Awaited<ReturnType<typeof loadOrder>>;

function customerVars(o: LoadedOrder) {
  return {
    customer_name: o.contact_name?.trim() || "there",
    order_number: o.number,
    order_total: formatAED(o.total_fils),
    order_lines: o.gift_card_purchase
      ? `Solei gift card — ${formatAED(o.total_fils)}`
      : formatOrderLines(o.lines),
    order_link: GUEST_LINK_CHANNELS.has(o.channel) ? orderUrl(o.id, o.number) : "",
  };
}

const refs = (o: LoadedOrder) => ({
  to: o.contact_email,
  customerId: o.customer_id,
  orderId: o.id,
});

async function guard(what: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`order notification (${what}) failed`, e);
  }
}

/** Order fully paid: confirmation to the customer, alert to the owner, low-stock check, passport stamp. */
export function notifyOrderPaid(orderId: string) {
  return guard("paid", async () => {
    const o = await loadOrder(orderId);
    // Booking deposits/balances: the bookings module sends `booking_confirmed` instead.
    if (o.channel === "booking") return;
    // Gift card purchases: the card itself (and a receipt) instead of an order confirmation.
    if (o.gift_card_purchase) await notifyGiftCardPurchase(o);
    else await notify("order_confirmation", { ...refs(o), vars: customerVars(o) });

    // POS sales happen in front of the owner's team; alert only for remote orders.
    if (o.channel !== "pos") {
      const owner = await ownerEmail();
      if (owner) {
        await notify("owner_new_order", {
          to: owner,
          orderId: o.id,
          vars: {
            ...customerVars(o),
            channel: CHANNEL_LABELS[o.channel],
            customer_phone: o.contact_phone ? formatPhone(o.contact_phone) : "—",
            delivery_area:
              o.fulfilment === "delivery" ? humanize(o.delivery_emirate) : humanize(o.fulfilment),
            admin_link: adminUrl(`/admin/orders/${o.id}`),
          },
        });
      }
    }
    await checkLowStock(o.lines.map((l) => l.variant_id));
    // Stamps were awarded in the same transaction that settled the order.
    await notifyPassportForOrder(o.id);
  });
}

/** Status moved to preparing / dispatched / delivered → tell the customer. */
export function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const key = CUSTOMER_STATUS_TEMPLATES[status];
  if (!key) return Promise.resolve();
  return guard(`status ${status}`, async () => {
    const o = await loadOrder(orderId);
    await notify(key, {
      ...refs(o),
      vars: { ...customerVars(o), tracking: trackingText(o.tracking_number, o.courier) },
    });
  });
}

/** Online payment failed or expired → retry link. Skipped once the order is paid or cancelled. */
export function notifyPaymentFailed(orderId: string) {
  return guard("payment failed", async () => {
    const o = await loadOrder(orderId);
    if (o.status !== "pending_payment" || o.outstandingFils <= 0) return;
    await notify("payment_failed", { ...refs(o), vars: customerVars(o) });
  });
}

/** A recorded payment that didn't complete the order (e.g. a deposit or part payment). */
export function notifyPaymentReceived(orderId: string, amountFils: number) {
  return guard("payment received", async () => {
    const o = await loadOrder(orderId);
    await notify("payment_received", {
      ...refs(o),
      vars: {
        ...customerVars(o),
        amount: formatAED(amountFils),
        outstanding: formatAED(Math.max(0, o.outstandingFils)),
      },
    });
  });
}

/**
 * Email the owner about variants at or below their alert level. One alert per SKU per 24 h
 * (dedupe key = SKU), so a run of sales doesn't flood the inbox.
 */
export function checkLowStock(variantIds: string[]) {
  const ids = [...new Set(variantIds.filter(Boolean))];
  if (!ids.length) return Promise.resolve();
  return guard("low stock", async () => {
    const { data, error } = await createAdminClient().rpc("variant_stock_alerts", {
      p_variant_ids: ids,
    });
    if (error) throw new Error(error.message);
    const low = (data ?? []).filter((r) => r.is_low);
    if (!low.length) return;
    const owner = await ownerEmail();
    if (!owner) return;
    for (const r of low) {
      await notify("owner_low_stock", {
        to: owner,
        dedupeKey: r.sku,
        dedupeHours: 24,
        vars: {
          product: r.variant_label ? `${r.product_name} · ${r.variant_label}` : r.product_name,
          sku: r.sku,
          on_hand: r.on_hand,
          threshold: r.threshold,
          admin_link: adminUrl(`/admin/inventory/${r.variant_id}`),
        },
      });
    }
  });
}
