import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { cartLinkSecret } from "@/lib/env.server";
import { formatAED } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/server";
import { currentAccount } from "@/modules/account/service";
import { notify } from "@/modules/notifications/service";
import {
  describeChoices,
  fromDbOptions,
  toDbOptions,
  unitPriceWithOptions,
  type LineOptions,
} from "@/modules/catalog/options";
import { formatOrderLines } from "@/modules/orders/format";
import { fetchProductsForVariants } from "@/modules/storefront/queries";
import { cartToken, verifyCartToken, type CartLinkPurpose } from "./links";
import { getCartReminderSettings } from "./queries";
import { cartReminderSettingsSchema, savedLinesSchema } from "./schema";

type StoredLine = {
  variant_id: string;
  qty: number;
  options?: { group_id: string; option_ids?: string[]; text?: string | null }[];
};
type SavedLine = { variantId: string; qty: number; options?: LineOptions };
const fromStored = (l: StoredLine): SavedLine => ({
  variantId: l.variant_id,
  qty: l.qty,
  ...(l.options?.length ? { options: fromDbOptions(l.options) } : {}),
});

export const cartLink = (cartId: string, purpose: CartLinkPurpose) =>
  `${publicEnv.NEXT_PUBLIC_SITE_URL}/cart/${purpose === "restore" ? "restore" : "stop"}?c=${cartId}&t=${cartToken(cartId, purpose, cartLinkSecret())}`;

/** Mirror the signed-in customer's bag (no-op when signed out). */
export async function syncMyCart(input: unknown): Promise<void> {
  const account = await currentAccount();
  if (!account?.user.email) return;
  const lines = savedLinesSchema.parse(input);
  const name = [account.meta.first_name, account.meta.last_name].filter(Boolean).join(" ");
  const { error } = await createAdminClient().rpc("cart_sync", {
    p_user: account.user.id,
    p_email: account.user.email,
    p_name: name,
    p_lines: lines.map((l) => ({
      variant_id: l.variantId,
      qty: l.qty,
      options: toDbOptions(l.options),
    })),
  });
  if (error) throw new Error(`cart_sync failed: ${error.message}`);
}

/** The signed-in customer's saved bag (to bring it back on another device after signing in). */
export async function mySavedCart(): Promise<SavedLine[]> {
  const account = await currentAccount();
  if (!account) return [];
  const { data } = await createAdminClient()
    .from("carts")
    .select("lines")
    .eq("user_id", account.user.id)
    .eq("status", "open")
    .maybeSingle();
  return ((data?.lines ?? []) as StoredLine[]).map(fromStored);
}

/** "Return to your bag" from the email: the bag's lines (empty once it was bought). */
export async function restoreCartFromLink(cartId: string, token: string): Promise<SavedLine[]> {
  if (!verifyCartToken(cartId, "restore", token, cartLinkSecret())) {
    throw new UserError("This link isn't valid any more.");
  }
  const admin = createAdminClient();
  const { data } = await admin.from("carts").select("status, lines").eq("id", cartId).maybeSingle();
  if (!data || data.status !== "open") return [];
  await admin.from("carts").update({ link_opened_at: new Date().toISOString() }).eq("id", cartId);
  return (data.lines as StoredLine[]).map(fromStored);
}

/** "Turn them off" from the email (a button on the page, so link scanners can't trigger it). */
export async function stopRemindersFromLink(cartId: string, token: string) {
  if (!verifyCartToken(cartId, "optout", token, cartLinkSecret())) {
    throw new UserError("This link isn't valid any more.");
  }
  const admin = createAdminClient();
  const { data } = await admin.from("carts").select("user_id").eq("id", cartId).maybeSingle();
  if (!data) throw new UserError("This link isn't valid any more.");
  const { error } = await admin.rpc("cart_set_optout", { p_user: data.user_id, p_out: true });
  if (error) throw new Error(error.message);
}

/** Account page switch. */
export async function setMyCartReminders(on: boolean) {
  const account = await currentAccount();
  if (!account) throw new UserError("Please sign in.");
  const { error } = await createAdminClient().rpc("cart_set_optout", {
    p_user: account.user.id,
    p_out: !on,
  });
  if (error) throw new Error(error.message);
}

/** A paid order closes the buyer's open bag. Never throws (it runs after a payment). */
export async function closeCartForOrder(orderId: string) {
  const { error } = await createAdminClient().rpc("cart_order_paid", { p_order_id: orderId });
  if (error) console.error("cart_order_paid failed", error.message);
}

/**
 * Email every bag that is due a reminder (scheduler or "Send due reminders now"). Lines are
 * re-priced from the catalogue; items no longer sold are left out (no email when none are left).
 */
export async function sendDueCartReminders(): Promise<{ sent: number; skipped: number }> {
  const settings = await getCartReminderSettings();
  if (!settings.enabled) return { sent: 0, skipped: 0 };
  const admin = createAdminClient();
  const { data: due, error } = await admin.rpc("carts_due_for_reminder");
  if (error) throw new Error(`carts_due_for_reminder failed: ${error.message}`);
  if (!due.length) return { sent: 0, skipped: 0 };

  const variantIds = [
    ...new Set(due.flatMap((c) => (c.lines as StoredLine[]).map((l) => l.variant_id))),
  ];
  const products = await fetchProductsForVariants(variantIds);
  const byVariant = new Map(
    products.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)),
  );

  let sent = 0;
  let skipped = 0;
  for (const cart of due) {
    const lines = (cart.lines as StoredLine[]).flatMap((l) => {
      const m = byVariant.get(l.variant_id);
      if (!m) return [];
      return [
        {
          product_name: m.product.name,
          variant_label:
            [
              m.product.variants.length > 1 ? m.variant.label : "",
              describeChoices(m.product.optionGroups, fromDbOptions(l.options)),
            ]
              .filter(Boolean)
              .join(" · ") || null,
          qty: l.qty,
          line_total_fils:
            unitPriceWithOptions(
              m.variant.priceFils,
              m.product.optionGroups,
              fromDbOptions(l.options),
            ) * l.qty,
        },
      ];
    });
    if (!lines.length) {
      skipped++;
      continue;
    }
    const result = await notify("cart_reminder", {
      to: cart.email,
      dedupeKey: `cart:${cart.id}:${cart.reminders_sent + 1}`,
      dedupeHours: 24 * 60,
      vars: {
        customer_name: cart.name?.split(" ")[0] || "there",
        cart_lines: formatOrderLines(lines),
        cart_total: formatAED(lines.reduce((s, l) => s + l.line_total_fils, 0)),
        cart_link: cartLink(cart.id, "restore"),
        unsubscribe_link: cartLink(cart.id, "optout"),
      },
    });
    if (result.status === "sent") {
      await admin.rpc("cart_reminder_sent", { p_cart: cart.id });
      sent++;
    } else skipped++;
  }
  return { sent, skipped };
}

/** "Send due reminders now" in the admin. */
export async function runCartRemindersNow() {
  await assertPermission("settings.manage");
  return sendDueCartReminders();
}

export async function saveCartReminderSettings(input: unknown) {
  const staff = await assertPermission("settings.manage");
  const v = cartReminderSettingsSchema.parse(input);
  const { error } = await createAdminClient()
    .from("settings")
    .update({
      cart_reminders_enabled: v.enabled,
      cart_reminder_first_hours: v.firstHours,
      cart_reminder_second_hours: v.secondHours,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
