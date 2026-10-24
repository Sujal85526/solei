import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { CONTENT_TAGS } from "@/modules/content/queries";
import type { CartReminderSettings } from "./schema";

export async function getCartReminderSettings(): Promise<CartReminderSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAGS.settings);
  if (process.env.CONTENT_FALLBACK === "1")
    return { enabled: false, firstHours: 4, secondHours: 48 };
  const { data, error } = await createPublicClient()
    .from("settings")
    .select("cart_reminders_enabled, cart_reminder_first_hours, cart_reminder_second_hours")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return {
    enabled: data.cart_reminders_enabled,
    firstHours: data.cart_reminder_first_hours,
    secondHours: data.cart_reminder_second_hours,
  };
}

export type AdminCart = {
  id: string;
  email: string;
  name: string | null;
  status: "open" | "converted" | "emptied";
  itemCount: number;
  valueFils: number;
  remindersSent: number;
  lastReminderAt: string | null;
  linkOpenedAt: string | null;
  order: { id: string; number: string; totalFils: number } | null;
  updatedAt: string;
  customerId: string | null;
};

export type CartFilter = "open" | "recovered" | "all";

/** Bags, newest activity first: open ones by default, or recovered, or every bag. */
export async function listCarts(filter: CartFilter = "open"): Promise<AdminCart[]> {
  await assertPermission("customers.view");
  const supabase = await createClient();
  let query = supabase
    .from("carts")
    .select(
      "id, email, name, status, item_count, value_fils, reminders_sent, last_reminder_at, link_opened_at, updated_at, orders(id, number, total_fils)",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (filter === "open") query = query.eq("status", "open");
  if (filter === "recovered") query = query.eq("status", "converted").gt("reminders_sent", 0);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Link to the customer record where one has the same email.
  const emails = [...new Set(data.map((c) => c.email))];
  const { data: customers } = emails.length
    ? await supabase.from("customers").select("id, email").in("email", emails)
    : { data: [] as { id: string; email: string | null }[] };
  const byEmail = new Map((customers ?? []).map((c) => [c.email, c.id]));

  return data.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    status: c.status,
    itemCount: c.item_count,
    valueFils: c.value_fils,
    remindersSent: c.reminders_sent,
    lastReminderAt: c.last_reminder_at,
    linkOpenedAt: c.link_opened_at,
    order: c.orders
      ? { id: c.orders.id, number: c.orders.number, totalFils: c.orders.total_fils }
      : null,
    updatedAt: c.updated_at,
    customerId: byEmail.get(c.email) ?? null,
  }));
}

export type CartStats = {
  abandoned: number;
  abandonedFils: number;
  reminded: number;
  recovered: number;
  recoveredFils: number;
};

/** Figures for the last 30 days (open bags left are counted as of now). */
export async function cartStats(): Promise<CartStats> {
  await assertPermission("customers.view");
  const supabase = await createClient();
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase.rpc("cart_stats", { p_from: from }).single();
  if (error) throw new Error(error.message);
  return {
    abandoned: data.abandoned,
    abandonedFils: data.abandoned_fils,
    reminded: data.reminded,
    recovered: data.recovered,
    recoveredFils: data.recovered_fils,
  };
}

/** Whether the signed-in customer turned bag reminders off (null when signed out). */
export async function myCartRemindersOff(userId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("cart_reminder_optouts")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
