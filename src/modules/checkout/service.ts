import "server-only";
import { publicEnv } from "@/lib/env";
import { orderLinkSecret } from "@/lib/env.server";
import { UserError } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/server";
import { currentAccount, rememberOrder, saveAddress } from "@/modules/account/service";
import { resolveCart } from "@/modules/cart/details";
import { checkCoupon } from "@/modules/coupons/queries";
import { normaliseCode, refusalMessage } from "@/modules/coupons/schema";
import { checkGiftCard } from "@/modules/gift-cards/queries";
import {
  giftCardApplies,
  giftCardRefusalMessage,
  normaliseGiftCode,
} from "@/modules/gift-cards/schema";
import { onOrderPaid } from "@/modules/orders/events";
import { pointsForCheckout } from "@/modules/points/service";
import {
  fetchAvailability,
  fetchProductsForVariants,
  getCartSettings,
} from "@/modules/storefront/queries";
import { paymentProvider } from "@/providers/payment";
import type { CheckoutLine } from "@/providers/payment/types";
import { orderToken } from "./order-link";
import { checkoutSchema, fullName } from "./schema";

const site = () => publicEnv.NEXT_PUBLIC_SITE_URL;

export function orderUrl(orderId: string, number: string, extra = "") {
  return `${site()}/order/${number}?t=${orderToken(orderId, orderLinkSecret())}${extra}`;
}

/**
 * Place a website order for the signed-in customer and return the hosted payment page URL.
 * The cart is re-resolved server-side (prices, stock, delivery fee); nothing from the client is
 * trusted. The contact email is the account's verified email.
 */
export async function placeOrder(
  input: unknown,
): Promise<{ redirectUrl: string; orderNumber: string }> {
  const account = await currentAccount();
  if (!account) throw new UserError("Please sign in to check out.");
  // Name and email come from the account; the delivery form only asks for address and mobile.
  const v = checkoutSchema.parse({
    ...(input as object),
    email: account.user.email,
    firstName: account.meta.first_name || account.user.email!.split("@")[0],
    lastName: account.meta.last_name ?? "",
  });
  const name = fullName(v);
  const ids = [...new Set(v.lines.map((l) => l.variantId))];
  const [products, availability, settings] = await Promise.all([
    fetchProductsForVariants(ids),
    fetchAvailability(ids),
    getCartSettings(),
  ]);
  let cart = resolveCart({ lines: v.lines, emirate: v.emirate }, products, availability, settings);

  const problems = cart.lines.filter((l) => l.status !== "ok");
  if (problems.length) {
    throw new UserError(
      problems.some((p) => p.status === "clamped")
        ? "Some items have limited stock — we've updated your cart. Please review it."
        : "Some items are no longer available — we've updated your cart. Please review it.",
    );
  }

  // Discount code: checked against the final bag and this customer; the order RPC checks again.
  const code = v.coupon ? normaliseCode(v.coupon) : "";
  if (code) {
    const check = await checkCoupon(code, cart.lines, v.email);
    if (!check.ok) throw new UserError(refusalMessage(check.reason, check.minOrderFils));
    cart = resolveCart({ lines: v.lines, emirate: v.emirate }, products, availability, settings, {
      code: check.code,
      discountFils: check.discountFils,
      freeDelivery: check.freeDelivery,
    });
  }

  const pricing = cart.pricing;
  if (pricing.deliveryFeeFils === null) throw new UserError("Choose your emirate for delivery.");

  // Points first (when chosen), then a gift card for what's left; the order RPC re-checks both.
  let points = 0;
  let pointsCustomer: string | null = null;
  let dueFils = pricing.totalFils;
  if (v.usePoints) {
    const p = await pointsForCheckout(dueFils);
    if (!p?.usable)
      throw new UserError("Your points can't be used on this order — please review it.");
    points = p.points;
    pointsCustomer = p.customerId;
    dueFils -= p.valueFils;
  }
  let giftCode: string | null = null;
  let giftFils = 0;
  if (v.giftCard) {
    giftCode = normaliseGiftCode(v.giftCard);
    const check = giftCode ? await checkGiftCard(giftCode) : null;
    if (!check?.ok) throw new UserError(giftCardRefusalMessage(check?.reason ?? "invalid"));
    giftFils = giftCardApplies(check.balanceFils, dueFils);
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .rpc("create_web_order", {
      p: {
        client_uuid: v.clientUuid,
        fulfilment: "delivery",
        emirate: v.emirate,
        notes: v.notes,
        marketing_consent: v.marketingConsent,
        contact: { name, phone: v.phone, email: v.email },
        address: { line1: v.line1, line2: v.line2, area: v.area, city: v.city, emirate: v.emirate },
        lines: cart.lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          unit_price_fils: l.unitPriceFils,
        })),
        subtotal_fils: pricing.subtotalFils,
        coupon_code: code || null,
        discount_fils: pricing.discountFils,
        delivery_discount_fils: pricing.deliveryDiscountFils,
        delivery_fee_fils: pricing.deliveryFeeFils,
        vat_fils: pricing.vatFils,
        total_fils: pricing.totalFils,
        vat_rate_bp: settings.vatRateBp,
        prices_include_vat: settings.pricesIncludeVat,
        gift_card_code: giftFils > 0 ? giftCode : null,
        gift_card_fils: giftFils,
        points,
        points_customer: pointsCustomer,
      },
    })
    .single();
  if (error) {
    if (error.code === "P0001") throw new UserError(capitalise(error.message));
    throw new Error(`create_web_order failed: ${error.message}`);
  }

  const { line1, line2, area, city, emirate } = v;
  await Promise.all([
    rememberOrder(account.user, created.order_id),
    v.saveAddress
      ? saveAddress({ line1, line2, area, city, emirate }).catch((e) =>
          console.error("save address failed", e),
        )
      : null,
  ]);

  // Paid in full by the gift card: no payment page — straight to the confirmation.
  const { data: placed } = await admin
    .from("orders")
    .select("paid_at")
    .eq("id", created.order_id)
    .single();
  if (placed?.paid_at) {
    if (!created.existing)
      await onOrderPaid({ id: created.order_id, number: created.order_number });
    return {
      redirectUrl: orderUrl(created.order_id, created.order_number, "&paid=1"),
      orderNumber: created.order_number,
    };
  }

  const lines: CheckoutLine[] = cart.lines.map((l) => ({
    name: l.product?.name ?? "Solei",
    description: l.variantLabel || undefined,
    unitAmountFils: l.unitPriceFils,
    quantity: l.qty,
    imageUrl: l.product?.image?.url.startsWith("http") ? l.product.image.url : undefined,
  }));
  if (pricing.deliveryFeeFils > 0) {
    lines.push({
      name: `Delivery — ${cart.zoneName ?? v.emirate}`,
      unitAmountFils: pricing.deliveryFeeFils,
      quantity: 1,
    });
  }
  if (!pricing.vatIncluded && pricing.vatFils > 0) {
    lines.push({ name: "VAT", unitAmountFils: pricing.vatFils, quantity: 1 });
  }
  // With a discount the item lines no longer add up to the amount due, so the payment page shows
  // one "Solei order …" line for the total instead (see startPayment).

  const url = await startPayment(created.order_id, { lines, email: v.email });
  return { redirectUrl: url, orderNumber: created.order_number };
}

/**
 * Create a hosted payment session for the order's outstanding amount and record a pending payment.
 * Used by checkout and by "complete payment" retries; older pending attempts are cancelled.
 */
export async function startPayment(
  orderId: string,
  opts: {
    lines?: CheckoutLine[];
    email?: string | null;
    /** Where the hosted page returns to (default: the guest order page). */
    successUrl?: string;
    cancelUrl?: string;
  } = {},
): Promise<string> {
  const admin = createAdminClient();
  const [{ data: order }, { data: summary }] = await Promise.all([
    admin.from("orders").select("id, number, status, contact_email").eq("id", orderId).single(),
    admin.from("order_payment_summary").select("outstanding_fils").eq("order_id", orderId).single(),
  ]);
  if (!order) throw new UserError("Order not found.");
  const outstanding = summary?.outstanding_fils ?? 0;
  if (order.status === "cancelled") throw new UserError("This order was cancelled.");
  if (outstanding <= 0) throw new UserError("This order is already paid.");

  const provider = paymentProvider();
  const lines =
    opts.lines && opts.lines.reduce((s, l) => s + l.unitAmountFils * l.quantity, 0) === outstanding
      ? opts.lines
      : [{ name: `Solei order ${order.number}`, unitAmountFils: outstanding, quantity: 1 }];

  const successUrl = opts.successUrl ?? orderUrl(order.id, order.number, "&paid=1");
  const cancelUrl = opts.cancelUrl ?? orderUrl(order.id, order.number, "&cancelled=1");
  const session = await provider.createCheckout({
    orderId: order.id,
    orderNumber: order.number,
    lines,
    amountFils: outstanding,
    customerEmail: opts.email ?? order.contact_email,
    successUrl,
    cancelUrl,
  });

  await admin
    .from("payments")
    .update({ status: "cancelled", note: "Superseded by a new payment attempt" })
    .eq("order_id", order.id)
    .eq("status", "pending")
    .eq("kind", "payment");

  const { error } = await admin.from("payments").insert({
    order_id: order.id,
    kind: "payment",
    amount_fils: outstanding,
    method: "online_card",
    status: "pending",
    provider: provider.name,
    provider_ref: session.providerRef,
    provider_payload: {
      success_url: successUrl,
      cancel_url: cancelUrl,
      expires_at: session.expiresAt ?? null,
    },
  });
  if (error) throw new Error(`payment insert failed: ${error.message}`);
  return session.url;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith(".") ? "" : ".");
}
