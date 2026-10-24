import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { currentAccount, rememberOrder } from "@/modules/account/service";
import { startPayment } from "@/modules/checkout/service";
import { checkGiftCard, getGiftCardSettings, type GiftCardCheck } from "./queries";
import { sendGiftCard } from "./notify";
import {
  giftCardAdjustSchema,
  giftCardIssueSchema,
  giftCardPurchaseSchema,
  giftCardSettingsSchema,
  giftCardVoidSchema,
  normaliseGiftCode,
} from "./schema";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Database refusals (P0001 / 22023) are written for people; pass them through as UserErrors. */
function rethrow(error: { code?: string; message: string }, what: string): never {
  if (error.code === "P0001" || error.code === "22023" || error.code === "42501") {
    throw new UserError(capitalise(error.message));
  }
  throw new Error(`${what} failed: ${error.message}`);
}

/**
 * Buy a gift card online (signed-in buyer): creates the purchase order and returns the hosted
 * payment page. The card goes live — and is emailed — when the payment webhook confirms it.
 */
export async function buyGiftCard(input: unknown): Promise<{ redirectUrl: string }> {
  const account = await currentAccount();
  if (!account) throw new UserError("Please sign in to buy a gift card.");
  const v = giftCardPurchaseSchema.parse(input);
  const settings = await getGiftCardSettings();
  if (!settings.enabled) throw new UserError("Gift cards aren't available right now.");
  if (!settings.amountsFils.includes(v.amountFils)) throw new UserError("Choose an amount.");

  const name =
    [account.meta.first_name, account.meta.last_name].filter(Boolean).join(" ").trim() ||
    account.user.email!.split("@")[0];
  const { data, error } = await createAdminClient()
    .rpc("create_gift_card_order", {
      p: {
        client_uuid: v.clientUuid,
        contact: { name, email: account.user.email, phone: account.meta.phone ?? null },
        amount_fils: v.amountFils,
        recipient_name: v.forSomeoneElse ? v.recipientName : null,
        recipient_email: v.forSomeoneElse ? v.recipientEmail : null,
        sender_name: v.senderName ?? name,
        message: v.message,
      },
    })
    .single();
  if (error) rethrow(error, "create_gift_card_order");

  await rememberOrder(account.user, data.order_id);
  const redirectUrl = await startPayment(data.order_id, {
    lines: [
      {
        name: `Solei gift card — ${formatAED(v.amountFils)}`,
        unitAmountFils: v.amountFils,
        quantity: 1,
      },
    ],
    email: account.user.email,
  });
  return { redirectUrl };
}

/** Checkout: a signed-in customer checks a code (the order RPC checks it again when spending). */
export async function checkGiftCardForCustomer(code: string): Promise<GiftCardCheck> {
  const account = await currentAccount();
  if (!account) throw new UserError("Sign in to use a gift card.");
  const normalised = normaliseGiftCode(code);
  if (!normalised) return { ok: false, reason: "invalid" };
  return checkGiftCard(normalised);
}

/** Till: staff check a code before taking it as payment. */
export async function checkGiftCardAtTill(code: string): Promise<GiftCardCheck> {
  await assertPermission("pos.use");
  const settings = await getGiftCardSettings();
  if (!settings.atPos) throw new UserError("Gift cards can't be used at the till.");
  const normalised = normaliseGiftCode(code);
  if (!normalised) return { ok: false, reason: "invalid" };
  return checkGiftCard(normalised);
}

/** Staff issue a card by hand; emailed to the recipient when asked. Returns the card id. */
export async function issueGiftCard(input: unknown): Promise<string> {
  await assertPermission("gift_cards.manage");
  const v = giftCardIssueSchema.parse(input);
  if (v.sendEmail && !v.recipientEmail) {
    throw new UserError("Add the recipient's email to send the card.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gift_card_issue", {
    p: {
      amount_fils: v.amount,
      recipient_name: v.recipientName,
      recipient_email: v.recipientEmail,
      message: v.message,
      note: v.note,
    },
  });
  if (error) rethrow(error, "gift_card_issue");
  if (v.sendEmail) await sendGiftCard(data);
  return data;
}

export async function voidGiftCard(input: unknown) {
  await assertPermission("gift_cards.manage");
  const v = giftCardVoidSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("gift_card_void", { p_card: v.id, p_reason: v.reason });
  if (error) rethrow(error, "gift_card_void");
}

/** Returns the new balance. */
export async function adjustGiftCard(input: unknown): Promise<number> {
  await assertPermission("gift_cards.manage");
  const v = giftCardAdjustSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gift_card_adjust", {
    p_card: v.id,
    p_amount: v.amount,
    p_reason: v.reason,
  });
  if (error) rethrow(error, "gift_card_adjust");
  return data;
}

export async function resendGiftCard(id: string) {
  await assertPermission("gift_cards.manage");
  const result = await sendGiftCard(id, { resend: true });
  if (result.status !== "sent") {
    throw new UserError(
      result.reason === "no email" ? "This card has no recipient email." : "The email didn't send.",
    );
  }
}

/** Owner rules. Settings is a single row; audited by its trigger. */
export async function saveGiftCardSettings(input: unknown) {
  const staff = await assertPermission("gift_cards.manage");
  const v = giftCardSettingsSchema.parse(input);
  const { error } = await createAdminClient()
    .from("settings")
    .update({
      gift_cards_enabled: v.enabled,
      gift_card_amounts_fils: v.amounts,
      gift_card_expiry_months: v.expiryMonths,
      gift_cards_at_pos: v.atPos,
      updated_by: staff.userId,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
