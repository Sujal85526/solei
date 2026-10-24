import "server-only";
import { isUuid } from "@/lib/ids";
import { cacheLife, cacheTag } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { GiftCardRefusal, GiftCardSettings, GiftCardStatus } from "./schema";

/** Owner rules (public: the storefront shows the amounts). Cached; refreshed on save. */
export async function getGiftCardSettings(): Promise<GiftCardSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.settings);
  if (process.env.CONTENT_FALLBACK === "1") {
    return { enabled: true, amountsFils: [10000, 20000, 50000], expiryMonths: 12, atPos: true };
  }
  const { data, error } = await createPublicClient()
    .from("settings")
    .select(
      "gift_cards_enabled, gift_card_amounts_fils, gift_card_expiry_months, gift_cards_at_pos",
    )
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return {
    enabled: data.gift_cards_enabled,
    amountsFils: data.gift_card_amounts_fils,
    expiryMonths: data.gift_card_expiry_months,
    atPos: data.gift_cards_at_pos,
  };
}

export type GiftCardRow = {
  id: string;
  code: string;
  initialFils: number;
  balanceFils: number;
  status: GiftCardStatus;
  expiresAt: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  senderName: string | null;
  message: string | null;
  note: string | null;
  purchaseOrder: { id: string; number: string } | null;
  issuedByStaff: boolean;
  sentAt: string | null;
  voidReason: string | null;
  createdAt: string;
};

const CARD_COLUMNS =
  "id, code, initial_fils, status, expires_at, recipient_name, recipient_email, sender_name, message, note, issued_by, sent_at, void_reason, created_at, orders:purchase_order_id(id, number), gift_card_ledger(amount_fils)";

type CardRecord = {
  id: string;
  code: string;
  initial_fils: number;
  status: GiftCardStatus;
  expires_at: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  sender_name: string | null;
  message: string | null;
  note: string | null;
  issued_by: string | null;
  sent_at: string | null;
  void_reason: string | null;
  created_at: string;
  orders: { id: string; number: string } | null;
  gift_card_ledger: { amount_fils: number }[];
};

const toRow = (r: CardRecord): GiftCardRow => ({
  id: r.id,
  code: r.code,
  initialFils: r.initial_fils,
  balanceFils: r.gift_card_ledger.reduce((s, l) => s + l.amount_fils, 0),
  status: r.status,
  expiresAt: r.expires_at,
  recipientName: r.recipient_name,
  recipientEmail: r.recipient_email,
  senderName: r.sender_name,
  message: r.message,
  note: r.note,
  purchaseOrder: r.orders,
  issuedByStaff: r.issued_by !== null,
  sentAt: r.sent_at,
  voidReason: r.void_reason,
  createdAt: r.created_at,
});

/** Newest first; `q` matches the code (any format) or the recipient's name / email. */
export async function listGiftCards(q?: string): Promise<GiftCardRow[]> {
  await assertPermission("gift_cards.view");
  const supabase = await createClient();
  let query = supabase
    .from("gift_cards")
    .select(CARD_COLUMNS)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);
  const term = q?.trim().replace(/[%,()]/g, "");
  if (term) {
    const code = term.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const parts = [`recipient_name.ilike.%${term}%`, `recipient_email.ilike.%${term}%`];
    if (code.length >= 4) parts.push(`code.ilike.%${code.slice(-4)}%`);
    query = query.or(parts.join(","));
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as CardRecord[]).map(toRow);
}

export type LedgerEntry = {
  id: number;
  entry: "issue" | "redeem" | "refund" | "adjust" | "void";
  amountFils: number;
  note: string | null;
  order: { id: string; number: string } | null;
  createdAt: string;
};

export async function getGiftCard(
  id: string,
): Promise<(GiftCardRow & { ledger: LedgerEntry[] }) | null> {
  await assertPermission("gift_cards.view");
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const [card, ledger] = await Promise.all([
    supabase.from("gift_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("gift_card_ledger")
      .select("id, entry, amount_fils, note, created_at, orders(id, number)")
      .eq("gift_card_id", id)
      .order("id"),
  ]);
  if (card.error) throw new Error(card.error.message);
  if (ledger.error) throw new Error(ledger.error.message);
  if (!card.data) return null;
  return {
    ...toRow(card.data as unknown as CardRecord),
    ledger: ledger.data.map((l) => ({
      id: l.id,
      entry: l.entry,
      amountFils: l.amount_fils,
      note: l.note,
      order: l.orders,
      createdAt: l.created_at,
    })),
  };
}

export type GiftCardSummary = {
  activeCards: number;
  outstandingFils: number;
  soldThisMonthFils: number;
  redeemedThisMonthFils: number;
};

export async function giftCardSummary(): Promise<GiftCardSummary> {
  await assertPermission("gift_cards.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gift_card_summary").single();
  if (error) throw new Error(error.message);
  return {
    activeCards: data.active_cards,
    outstandingFils: data.outstanding_fils,
    soldThisMonthFils: data.sold_this_month_fils,
    redeemedThisMonthFils: data.redeemed_this_month_fils,
  };
}

export type GiftCardCheck =
  | { ok: true; code: string; balanceFils: number; expiresAt: string | null }
  | { ok: false; reason: GiftCardRefusal };

/**
 * Look a code up for spending. Callers check who may ask first (a signed-in customer at
 * checkout, `pos.use` at the till); the database checks the card again when it's spent.
 */
export async function checkGiftCard(code: string): Promise<GiftCardCheck> {
  const { data, error } = await createAdminClient().rpc("gift_card_lookup", { p_code: code });
  if (error) throw new Error(`gift_card_lookup failed: ${error.message}`);
  const r = data as {
    ok: boolean;
    reason?: GiftCardRefusal;
    code?: string;
    balance_fils?: number;
    expires_at?: string | null;
  };
  return r.ok
    ? { ok: true, code: r.code!, balanceFils: r.balance_fils!, expiresAt: r.expires_at ?? null }
    : { ok: false, reason: r.reason ?? "invalid" };
}
