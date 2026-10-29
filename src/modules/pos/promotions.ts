"use server";

import { assertPermission } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { toDbOptions, type LineOptions } from "@/modules/catalog/options";
import { getRewardsProgramme } from "@/modules/points/queries";
import { pointsForOrder } from "@/modules/points/schema";
import { parseQuote } from "@/modules/promotions/quote";
import { tillDue, type TillQuote } from "./till";

/**
 * Price a sale in progress at the till (`pos_quote` → `promo_price` at this event): sale prices,
 * offers, the codes typed, and — when the customer is known — their points and VIP codes.
 */
export async function posQuoteAction(input: {
  eventId: string;
  lines: {
    variantId: string;
    qty: number;
    options?: LineOptions;
    giveawayId?: string;
    rewardId?: string;
  }[];
  codes: string[];
  customerPhone?: string;
  customerEmail?: string;
}): Promise<ActionResult<TillQuote>> {
  try {
    await assertPermission("pos.use");
    const phone = input.customerPhone ? normalizePhone(input.customerPhone) : null;
    const supabase = await createClient();
    const [{ data, error }, { settings }] = await Promise.all([
      supabase.rpc("pos_quote", {
        p: {
          event_id: input.eventId,
          customer_phone: phone?.ok ? phone.e164 : null,
          customer_email: input.customerEmail?.trim().toLowerCase() || null,
          coupon_codes: input.codes,
          lines: input.lines.map((l) => ({
            variant_id: l.variantId,
            qty: l.qty,
            options: toDbOptions(l.options),
            giveaway_id: l.giveawayId ?? null,
            reward_id: l.rewardId ?? null,
          })),
        },
      }),
      getRewardsProgramme(),
    ]);
    if (error) throw new Error(error.message);
    const raw = data as { customer_id?: string | null; points_balance?: number | null };
    const quote = parseQuote(data);
    const balance = settings.enabled ? (raw.points_balance ?? null) : null;
    const rewardPoints = quote.lines.reduce((s, l) => s + (l.rewardPoints ?? 0), 0);
    const due = tillDue(quote, 0);
    const usable =
      balance === null
        ? 0
        : pointsForOrder(
            balance - rewardPoints,
            due,
            settings.pointValueFils,
            settings.minRedeemPoints,
          );
    return ok({
      quote,
      customerId: raw.customer_id ?? null,
      pointsBalance: balance,
      usablePoints: usable,
      pointValueFils: settings.pointValueFils,
    });
  } catch (e) {
    return fail(e);
  }
}
