import "server-only";
import type { User } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { stickerFacts } from "@/modules/customers/welcome";
import { stampsLine } from "@/modules/customers/welcome-text";
import { notify } from "@/modules/notifications/service";

const KEY = "account_welcome";

/**
 * Welcome email for a new website account, sent once when its email is first verified. If the
 * team already added this person (earlier Instagram / WhatsApp orders), their stickers are
 * counted in the message. Never throws: a broken email must not break signing in.
 */
export async function sendAccountWelcome(user: User) {
  try {
    const email = user.email?.trim().toLowerCase();
    if (!email) return;
    const admin = createAdminClient();

    // Once per address — only real sends count (a skipped attempt must not block the real one).
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("template_key", KEY)
      .eq("recipient", email)
      .eq("status", "sent");
    if (count) return;

    const { data: customer } = await admin
      .from("customers")
      .select("id, name")
      .eq("email", email)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const { p, reward } = await stickerFacts(customer?.id ?? null);
    const first =
      typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : "";
    const site = publicEnv.NEXT_PUBLIC_SITE_URL;

    await notify(KEY, {
      to: email,
      customerId: customer?.id ?? null,
      vars: {
        customer_name: first.trim() || customer?.name?.trim() || "there",
        stamps: p.collected,
        stamps_for_reward: p.total,
        remaining: p.remaining,
        reward,
        stamps_line: stampsLine(p, reward),
        shop_link: `${site}/shop`,
        passport_link: `${site}/passport`,
      },
    });
  } catch (e) {
    console.error("account welcome failed", e);
  }
}
