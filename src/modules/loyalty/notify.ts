import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { notify } from "@/modules/notifications/service";
import { progress } from "./engine";
import { destinationList } from "./format";

/** Never re-send for the same order (a year is "never" for a dedupe window). */
const ONCE = 24 * 365;

/**
 * After a paid order earned stamps: "You collected Capri — 8/12" (`passport_stamp`), or
 * `reward_unlocked` when the order completed a card. Uses the templates' enabled flags and
 * skips customers without an email. Never throws.
 */
export async function notifyPassportForOrder(orderId: string) {
  try {
    const admin = createAdminClient();
    const { data: stamps } = await admin
      .from("loyalty_stamps")
      .select("stamps, destinations(name)")
      .eq("order_id", orderId)
      .eq("kind", "earned");
    if (!stamps?.length) return;

    const { data: order } = await admin
      .from("orders")
      .select("id, customer_id, contact_name, contact_email, customers(id, name, email)")
      .eq("id", orderId)
      .single();
    if (!order?.customer_id) return;
    const customerId = order.customer_id;
    const to = order.customers?.email || order.contact_email;
    const name = order.customers?.name?.trim() || order.contact_name?.trim() || "there";

    const [{ data: balance }, { data: rule }, { data: unlocked }] = await Promise.all([
      admin.from("loyalty_balances").select("balance").eq("customer_id", customerId).maybeSingle(),
      admin
        .from("loyalty_rule_versions")
        .select("stamps_for_reward, reward_label")
        .lte("effective_from", new Date().toISOString())
        .order("effective_from", { ascending: false })
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("loyalty_rewards")
        .select("id, reward_label, stamps_cost")
        .eq("source_order_id", orderId)
        .eq("status", "available"),
    ]);
    if (!rule) return;
    const passportLink = `${publicEnv.NEXT_PUBLIC_SITE_URL}/passport`;
    const base = { to, customerId, orderId, dedupeKey: `order:${orderId}`, dedupeHours: ONCE };

    if (unlocked?.length) {
      await notify("reward_unlocked", {
        ...base,
        vars: {
          customer_name: name,
          stamps_for_reward: unlocked[0].stamps_cost,
          reward: unlocked.length > 1 ? `${unlocked.length} rewards` : unlocked[0].reward_label,
          passport_link: passportLink,
        },
      });
      return;
    }
    const p = progress(balance?.balance ?? 0, rule.stamps_for_reward);
    await notify("passport_stamp", {
      ...base,
      vars: {
        customer_name: name,
        destination: destinationList(stamps.map((s) => s.destinations?.name ?? "")),
        stamps: p.collected,
        stamps_for_reward: p.total,
        remaining: p.remaining,
        reward: rule.reward_label,
        passport_link: passportLink,
      },
    });
  } catch (e) {
    console.error("passport notification failed", e);
  }
}
