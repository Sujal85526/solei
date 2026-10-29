import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { isUuid } from "@/lib/ids";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import { toDbOptions, type LineOptions } from "@/modules/catalog/options";
import { parseQuote, type LiveSale, type PromoQuote } from "./quote";
import { toBanner, toOffer, toReward, type Banner, type Offer, type PointsReward } from "./schema";

/** Cache tag for live sales and banners (revalidated by every promotions edit). */
export const PROMOTIONS_TAG = "promotions";

export type QuoteInputLine = {
  variantId: string;
  qty: number;
  options?: LineOptions;
  giveawayId?: string;
  rewardId?: string;
};

export const toDbLine = (l: QuoteInputLine) => ({
  variant_id: l.variantId,
  qty: l.qty,
  options: toDbOptions(l.options),
  giveaway_id: l.giveawayId ?? null,
  reward_id: l.rewardId ?? null,
});

/**
 * Price a website bag in the database (`cart_quote` → `promo_price`): sale prices, bundles, buy X
 * get Y and the codes, for the signed-in customer when there is one.
 */
export async function quoteCart(
  lines: QuoteInputLine[],
  codes: string[],
  email: string | null,
  customerId: string | null,
): Promise<PromoQuote> {
  const { data, error } = await createAdminClient().rpc("cart_quote", {
    p_lines: lines.map(toDbLine),
    p_codes: codes,
    p_email: email as string,
    p_customer: customerId as string,
  });
  if (error) throw new Error(`cart_quote failed: ${error.message}`);
  return parseQuote(data);
}

/**
 * Sales running on the website, with the products each one covers (null = all), for was/now
 * prices on shop cards and product pages. Cached; the bag and checkout always ask the database.
 */
export async function listLiveSales(): Promise<LiveSale[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PROMOTIONS_TAG);
  const db = createPublicClient();
  const [offers, products] = await Promise.all([
    db
      .from("offers")
      .select(
        "id, name, percent_bp, amount_fils, product_ids, category_ids, channels, starts_at, ends_at",
      )
      .eq("kind", "sale")
      .eq("active", true)
      .order("sort")
      .order("created_at"),
    db.from("products").select("id, category_id"),
  ]);
  // Before the promotions migration (e.g. the live DB) there are simply no sales.
  if (offers.error || products.error) return [];
  return offers.data
    .filter((o) => o.channels.includes("website"))
    .filter((o) => !o.ends_at || new Date(o.ends_at) > new Date())
    .map((o) => ({
      id: o.id,
      name: o.name,
      percentBp: o.percent_bp,
      amountFils: o.amount_fils,
      productIds:
        o.product_ids.length === 0 && o.category_ids.length === 0
          ? null
          : products.data
              .filter((p) => o.product_ids.includes(p.id) || o.category_ids.includes(p.category_id))
              .map((p) => p.id),
      startsAt: o.starts_at,
      endsAt: o.ends_at,
    }));
}

/** Banners showing now (the announcement bar and the homepage), in the admin's order. */
export async function listLiveBanners(): Promise<Banner[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PROMOTIONS_TAG);
  const { data, error } = await createPublicClient()
    .from("promo_banners")
    .select("*")
    .eq("active", true)
    .order("sort")
    .order("created_at");
  if (error) return [];
  const now = new Date();
  return data
    .map(toBanner)
    .filter(
      (b) =>
        (!b.startsAt || new Date(b.startsAt) <= now) && (!b.endsAt || new Date(b.endsAt) > now),
    );
}

/** Rewards customers can buy with points (live ones, with their product and price). */
export async function listLiveRewards(): Promise<PointsReward[]> {
  const { data, error } = await createAdminClient()
    .from("points_rewards")
    .select(rewardSelect)
    .eq("active", true)
    .order("sort")
    .order("points");
  if (error) return [];
  return data.map(toReward).filter((r) => r.variantActive);
}

const rewardSelect = `id, variant_id, points, active, sort,
  variant:product_variants (label, price_fils, active, product:products (name, active))` as const;

// ── Admin ────────────────────────────────────────────────────────────────────────────────────

export async function listOffers(): Promise<Offer[]> {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .order("sort")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(toOffer);
}

export async function getOffer(id: string): Promise<Offer | null> {
  await assertPermission("coupons.manage");
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("offers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toOffer(data) : null;
}

export async function listBanners(): Promise<Banner[]> {
  await assertPermission("coupons.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_banners")
    .select("*")
    .order("placement")
    .order("sort")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data.map(toBanner);
}

export async function listRewards(): Promise<PointsReward[]> {
  await assertPermission("loyalty.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("points_rewards")
    .select(rewardSelect)
    .order("sort")
    .order("points");
  if (error) throw new Error(error.message);
  return data.map(toReward);
}

/** Variants a reward can be (every active product's variants). */
export async function listRewardVariants(): Promise<{ id: string; label: string }[]> {
  await assertPermission("loyalty.manage");
  const { data, error } = await createAdminClient()
    .from("product_variants")
    .select("id, label, price_fils, product:products (name)")
    .eq("active", true)
    .order("sku");
  if (error) throw new Error(error.message);
  return data.map((v) => ({
    id: v.id,
    label: [v.product?.name, v.label].filter(Boolean).join(" · "),
  }));
}

export type PromotionPerformanceRow = {
  kind: "code" | "sale" | "bundle" | "buy_x_get_y";
  id: string | null;
  name: string;
  code: string | null;
  eventName: string | null;
  orders: number;
  discountFils: number;
  deliveryDiscountFils: number;
  salesFils: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

/** Every promotion used on paid orders between two business days (inclusive). */
export async function promotionPerformance(
  from: string,
  to: string,
): Promise<PromotionPerformanceRow[]> {
  await assertPermission("reports.view");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promotion_performance", { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    kind: r.kind as PromotionPerformanceRow["kind"],
    id: r.promotion_id,
    name: r.name,
    code: r.code,
    eventName: r.event_name,
    orders: r.orders,
    discountFils: r.discount_fils,
    deliveryDiscountFils: r.delivery_discount_fils,
    salesFils: r.sales_fils,
    firstOrderAt: r.first_order_at,
    lastOrderAt: r.last_order_at,
  }));
}
