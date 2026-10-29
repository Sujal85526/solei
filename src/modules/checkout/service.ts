import "server-only";
import { publicEnv } from "@/lib/env";
import { orderLinkSecret } from "@/lib/env.server";
import { UserError } from "@/lib/action-result";
import { createAdminClient } from "@/lib/supabase/server";
import { currentAccount, rememberOrder, saveAddress } from "@/modules/account/service";
import { resolveCart } from "@/modules/cart/details";
import { toDbOptions } from "@/modules/catalog/options";
import { refusalMessage } from "@/modules/coupons/schema";
import { checkGiftCard } from "@/modules/gift-cards/queries";
import { fetchGiveaways } from "@/modules/giveaways/queries";
import {
  giftCardApplies,
  giftCardRefusalMessage,
  normaliseGiftCode,
} from "@/modules/gift-cards/schema";
import { onOrderPaid } from "@/modules/orders/events";
import { checkoutCustomer, pointsForCheckout } from "@/modules/points/service";
import { priceBag, rewardPointsOf, rewardValueOf } from "@/modules/promotions/bag";
import { listLiveRewards } from "@/modules/promotions/queries";
import { normaliseCodes } from "@/modules/promotions/quote";
import {
  fetchAvailability,
  fetchProductsForVariants,
  getCartSettings,
} from "@/modules/storefront/queries";
import { paymentProvider } from "@/providers/payment";
import type { CheckoutLine } from "@/providers/payment/types";
import { billingFromOrder } from "./billing";
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
  const codes = normaliseCodes(v.coupons.length ? v.coupons : [v.coupon]);
  const giveawayIds = [...new Set(v.lines.flatMap((l) => (l.giveawayId ? [l.giveawayId] : [])))];
  const [settings, liveRewards, buyer, giveaways] = await Promise.all([
    getCartSettings(),
    v.rewards.length ? listLiveRewards() : [],
    checkoutCustomer(),
    fetchGiveaways(giveawayIds),
  ]);
  const ids = [
    ...new Set([
      ...v.lines.map((l) => l.variantId),
      ...liveRewards.filter((r) => v.rewards.includes(r.id)).map((r) => r.variantId),
    ]),
  ];
  const [products, availability] = await Promise.all([
    fetchProductsForVariants(ids),
    fetchAvailability(ids),
  ]);
  // Prices, sale prices, offers and codes from the database (the order RPC prices it again).
  const { details: cart, quote } = await priceBag({
    lines: v.lines,
    codes,
    rewardIds: buyer ? v.rewards : [],
    email: v.email,
    customerId: buyer?.id ?? null,
    settings,
    resolve: (lines) =>
      resolveCart({ lines, emirate: v.emirate }, products, availability, settings, null, giveaways),
  });

  const problems = cart.lines.filter((l) => l.status !== "ok");
  if (problems.length) {
    throw new UserError(
      problems.some((p) => p.status === "clamped")
        ? "Some items have limited stock — we've updated your cart. Please review it."
        : "Some items are no longer available — we've updated your cart. Please review it.",
    );
  }
  if (v.rewards.length && cart.lines.filter((l) => l.rewardId).length !== v.rewards.length)
    throw new UserError("A reward you chose is no longer available — please review your order.");
  const refused = quote?.codes.find((c) => !c.ok);
  if (refused && !refused.ok)
    throw new UserError(refusalMessage(refused.reason, refused.minOrderFils, refused.minItems));

  const pricing = cart.pricing;
  if (pricing.deliveryFeeFils === null) throw new UserError("Choose your emirate for delivery.");

  // Rewards are paid by points; then points (when chosen), then a gift card for what's left. The
  // order RPC re-checks all of them.
  let points = 0;
  let pointsCustomer: string | null = buyer?.id ?? null;
  let dueFils = pricing.totalFils - rewardValueOf(cart);
  if (v.usePoints) {
    const p = await pointsForCheckout(dueFils, rewardPointsOf(cart));
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
          options: toDbOptions(l.options),
          giveaway_id: l.giveawayId ?? null,
          reward_id: l.rewardId ?? null,
        })),
        subtotal_fils: pricing.subtotalFils,
        coupon_code: codes[0] ?? null,
        coupon_codes: codes,
        customer_id: buyer?.id ?? null,
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
    description: [l.variantLabel, l.optionsText].filter(Boolean).join(" · ") || undefined,
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
    admin
      .from("orders")
      .select("id, number, status, contact_email, contact_name, delivery_address, delivery_emirate")
      .eq("id", orderId)
      .single(),
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
    billing: billingFromOrder(order),
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
