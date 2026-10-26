import "server-only";
import { publicEnv } from "@/lib/env";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { billingFromOrder } from "@/modules/checkout/billing";
import { orderUrl } from "@/modules/checkout/service";
import { notify } from "@/modules/notifications/service";
import { paymentProvider } from "@/providers/payment";
import { manualOrderSchema, paymentLinkMessage, waLink } from "./manual-schema";
import { onOrderPaid } from "./events";

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "P0001" || error.code === "22023" || error.code === "P0002") {
    throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  }
  throw new Error(error.message);
}

/** Create a WhatsApp / direct order, record any payment received now, return the order. */
export async function createManualOrder(input: unknown) {
  const staff = await assertPermission("orders.create");
  const v = manualOrderSchema.parse(input);
  if (
    v.lines.some((l) => l.unitPriceFils !== l.listPriceFils) &&
    !can(staff.permissions, "orders.price_override")
  ) {
    throw new UserError("You don't have permission to change prices.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_manual_order", {
      p: {
        client_uuid: v.clientUuid,
        channel: v.channel,
        customer_id: v.customerId,
        fulfilment: v.fulfilment,
        delivery_address:
          v.fulfilment === "delivery" ? { ...v.deliveryAddress, emirate: v.deliveryEmirate } : null,
        delivery_emirate: v.fulfilment === "delivery" ? v.deliveryEmirate : null,
        delivery_fee_fils: v.fulfilment === "delivery" ? v.deliveryFeeFils : 0,
        notes: v.notes,
        lines: v.lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          unit_price_fils: l.unitPriceFils,
          override_reason: l.overrideReason,
        })),
      },
    })
    .single();
  if (error) dbError(error);

  let outstanding = data.outstanding_fils;
  const amount =
    v.payment.mode === "full"
      ? outstanding
      : v.payment.mode === "partial"
        ? v.payment.amountFils
        : 0;
  if (amount > 0) {
    await assertPermission("payments.record");
    const { data: paid, error: payError } = await supabase
      .rpc("record_payment", {
        p_order_id: data.order_id,
        p_amount_fils: Math.min(amount, outstanding),
        p_method: v.payment.method,
        p_reference: v.payment.reference || undefined,
      })
      .single();
    if (payError) dbError(payError);
    outstanding = paid.outstanding_fils;
    if (paid.newly_paid) await onOrderPaid({ id: data.order_id, number: data.order_number });
  }
  return {
    orderId: data.order_id,
    number: data.order_number,
    totalFils: data.total_fils,
    outstandingFils: outstanding,
  };
}

export type PaymentLinkResult = {
  url: string;
  whatsappUrl: string | null;
  message: string;
  amountFils: number;
};

/**
 * Hosted payment link for an order's outstanding balance (or part of it). The webhook marks the
 * payment and the link as paid. Card data never touches our servers.
 */
export async function createPaymentLink(
  orderId: string,
  amountFils?: number,
): Promise<PaymentLinkResult> {
  const staff = await assertPermission("payment_links.create");
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, number, status, contact_name, contact_phone, contact_email, delivery_address, delivery_emirate",
    )
    .eq("id", orderId)
    .single();
  if (!order) throw new UserError("Order not found.");
  if (order.status === "cancelled") throw new UserError("This order was cancelled.");
  const { data: summary } = await admin
    .from("order_payment_summary")
    .select("outstanding_fils")
    .eq("order_id", orderId)
    .single();
  const outstanding = summary?.outstanding_fils ?? 0;
  if (outstanding <= 0) throw new UserError("Nothing is outstanding on this order.");
  const amount = amountFils && amountFils > 0 ? Math.min(amountFils, outstanding) : outstanding;

  const provider = paymentProvider();
  if (provider.needsEmail && !order.contact_email)
    throw new UserError("Add the customer's email to the order first — the payment page needs it.");
  const session = await provider.createCheckout({
    orderId: order.id,
    orderNumber: order.number,
    lines: [{ name: `Solei order ${order.number}`, unitAmountFils: amount, quantity: 1 }],
    amountFils: amount,
    customerEmail: order.contact_email,
    billing: billingFromOrder(order),
    successUrl: orderUrl(order.id, order.number, "&paid=1"),
    cancelUrl: orderUrl(order.id, order.number),
  });

  const { error: payError } = await admin.from("payments").insert({
    order_id: order.id,
    kind: "payment",
    amount_fils: amount,
    method: "payment_link",
    status: "pending",
    provider: provider.name,
    provider_ref: session.providerRef,
    provider_payload: { source: "payment_link", created_by: staff.userId },
  });
  if (payError) throw new Error(payError.message);
  const { error: linkError } = await admin.from("payment_links").insert({
    order_id: order.id,
    amount_fils: amount,
    description: `Order ${order.number}`,
    provider: provider.name,
    provider_id: session.providerRef,
    url: session.url,
    expires_at: session.expiresAt ?? null,
    created_by: staff.userId,
  });
  if (linkError) throw new Error(linkError.message);

  const message = paymentLinkMessage({
    name: order.contact_name,
    number: order.number,
    amount: formatAED(amount),
    url: session.url,
  });
  return {
    url: session.url,
    amountFils: amount,
    message,
    whatsappUrl: order.contact_phone ? waLink(order.contact_phone, message) : null,
  };
}

/** Reminder for an outstanding balance: fresh payment link + email (if any) + WhatsApp text. */
export async function sendPaymentReminder(orderId: string) {
  const link = await createPaymentLink(orderId);
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, number, customer_id, contact_name, contact_email")
    .eq("id", orderId)
    .single();
  if (order?.contact_email) {
    await notify("payment_reminder", {
      to: order.contact_email,
      customerId: order.customer_id ?? undefined,
      orderId: order.id,
      vars: {
        customer_name: order.contact_name ?? "there",
        order_number: order.number,
        outstanding: formatAED(link.amountFils),
        payment_link: link.url,
      },
    });
  }
  return { ...link, emailed: Boolean(order?.contact_email) };
}

export const siteUrl = () => publicEnv.NEXT_PUBLIC_SITE_URL;
