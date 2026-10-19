import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import type { Tables } from "@/lib/database.types";
import { must } from "@/lib/supabase/must";
import { createAdminClient, createClient, createPublicClient } from "@/lib/supabase/server";
import type { LoyaltyRule, PassportHow, RewardStatus, RewardType, StampKind } from "./engine";

/** Cache tag for the public programme read (homepage band, passport page). */
export const LOYALTY_TAG = "loyalty";

type RuleRow = Tables<"loyalty_rule_versions">;

export type RuleVersion = LoyaltyRule & {
  rewardConfig: Record<string, unknown>;
  effectiveFrom: string;
  createdAt: string;
  createdBy: string | null;
  note: string | null;
};

export function toRule(r: RuleRow): RuleVersion {
  return {
    id: r.id,
    version: r.version,
    stampsPerItem: r.stamps_per_item,
    qualifyingCategoryIds: r.qualifying_category_ids,
    qualifyingProductIds: r.qualifying_product_ids,
    stampsForReward: r.stamps_for_reward,
    rewardType: r.reward_type,
    rewardConfig: (r.reward_config ?? {}) as Record<string, unknown>,
    rewardLabel: r.reward_label,
    issuePassportAfterPurchases: r.issue_passport_after_purchases,
    rewardItemsEarnStamps: r.reward_items_earn_stamps,
    expiryMonths: r.expiry_months,
    effectiveFrom: r.effective_from,
    createdAt: r.created_at,
    createdBy: r.created_by,
    note: r.note,
  };
}

/** The version in force now = latest effective_from in the past (same rule as SQL). */
export function activeVersion<T extends { effectiveFrom: string; version: number }>(
  versions: readonly T[],
  now = new Date(),
): T | null {
  return (
    [...versions]
      .filter((v) => new Date(v.effectiveFrom) <= now)
      .sort(
        (a, b) =>
          new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime() ||
          b.version - a.version,
      )[0] ?? null
  );
}

export type PublicProgramme = { enabled: boolean; rule: RuleVersion | null };

/** Public programme + active rule (cached; revalidated with the `loyalty` tag on settings save). */
export async function getPublicProgramme(): Promise<PublicProgramme> {
  "use cache";
  cacheLife("hours");
  cacheTag(LOYALTY_TAG);
  const db = createPublicClient();
  const [programme, versions] = await Promise.all([
    db.from("loyalty_programs").select("enabled").eq("id", 1).maybeSingle(),
    db
      .from("loyalty_rule_versions")
      .select("*")
      .lte("effective_from", new Date().toISOString())
      .order("effective_from", { ascending: false })
      .order("version", { ascending: false })
      .limit(1),
  ]);
  const rule = must(versions, "loyalty rules")[0];
  return { enabled: programme.data?.enabled ?? false, rule: rule ? toRule(rule) : null };
}

/**
 * Staff names for "who" columns — the whole (small) staff list in one read, shared per request,
 * so it runs alongside the main queries instead of after them. Callers must have checked a
 * loyalty permission first.
 */
const staffNames = cache(async (): Promise<Map<string, string>> => {
  const { data } = await createAdminClient().from("staff_profiles").select("user_id, full_name");
  return new Map((data ?? []).map((s) => [s.user_id, s.full_name]));
});

/** Settings screen: programme switch, every rule version (newest first) and pick lists. */
export async function getProgrammeAdmin() {
  const supabase = await createClient();
  const [programme, versions, categories, products, names] = await Promise.all([
    supabase.from("loyalty_programs").select("enabled, updated_at").eq("id", 1).single(),
    supabase.from("loyalty_rule_versions").select("*").order("version", { ascending: false }),
    supabase.from("categories").select("id, name").order("sort"),
    supabase.from("products").select("id, name, category_id, active").order("sort"),
    staffNames(),
  ]);
  const rules = must(versions, "loyalty rules").map(toRule);
  return {
    enabled: must(programme, "loyalty programme").enabled,
    active: activeVersion(rules),
    versions: rules.map((r) => ({
      ...r,
      createdByName: r.createdBy ? names.get(r.createdBy) : null,
    })),
    categories: must(categories, "categories"),
    products: must(products, "products"),
  };
}

export async function getOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_overview").single();
  if (error) throw new Error(`loyalty overview failed: ${error.message}`);
  return data;
}

export type LedgerEntry = {
  id: string;
  kind: StampKind;
  stamps: number;
  reason: string | null;
  createdAt: string;
  destination: string | null;
  order: { id: string; number: string } | null;
  ruleVersion: number | null;
  by: string | null;
  customer?: { id: string; name: string | null } | null;
};

const LEDGER_SELECT =
  "id, kind, stamps, reason, created_at, created_by, destinations(name), orders(id, number), loyalty_rule_versions(version), customers(id, name)";

type LedgerRow = {
  id: string;
  kind: StampKind;
  stamps: number;
  reason: string | null;
  created_at: string;
  created_by: string | null;
  destinations: { name: string } | null;
  orders: { id: string; number: string } | null;
  loyalty_rule_versions: { version: number } | null;
  customers: { id: string; name: string | null } | null;
};

function toLedger(rows: LedgerRow[], names: Map<string, string>): LedgerEntry[] {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    stamps: r.stamps,
    reason: r.reason,
    createdAt: r.created_at,
    destination: r.destinations?.name ?? null,
    order: r.orders,
    ruleVersion: r.loyalty_rule_versions?.version ?? null,
    by: r.created_by ? (names.get(r.created_by) ?? null) : null,
    customer: r.customers,
  }));
}

/** Latest ledger entries across all customers (admin overview). */
export async function recentActivity(limit = 20) {
  const supabase = await createClient();
  const [res, names] = await Promise.all([
    supabase
      .from("loyalty_stamps")
      .select(LEDGER_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit),
    staffNames(),
  ]);
  return toLedger(must(res, "loyalty activity") as unknown as LedgerRow[], names);
}

export type CustomerReward = {
  id: string;
  status: RewardStatus;
  label: string;
  type: RewardType;
  config: Record<string, unknown>;
  stampsCost: number;
  createdAt: string;
  redeemedAt: string | null;
  redeemedOrder: { id: string; number: string } | null;
  sourceOrder: { id: string; number: string } | null;
  note: string | null;
};

export type CustomerLoyalty = {
  balance: number;
  collected: number;
  passport: { number: string; how: PassportHow; issuedAt: string; by: string | null } | null;
  rewards: CustomerReward[];
  ledger: LedgerEntry[];
  ledgerTotal: number;
};

/**
 * One customer's card. Works for staff (loyalty.view) and for the customer themselves (RLS:
 * own rows only); staff names are only resolved for staff callers.
 */
export async function getCustomerLoyalty(
  customerId: string,
  opts: { ledgerLimit?: number; staff?: boolean } = {},
): Promise<CustomerLoyalty> {
  const supabase = await createClient();
  let ledgerQuery = supabase
    .from("loyalty_stamps")
    .select(LEDGER_SELECT, { count: "exact" })
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (opts.ledgerLimit) ledgerQuery = ledgerQuery.limit(opts.ledgerLimit);

  const [balance, passport, rewards, ledger, names] = await Promise.all([
    supabase
      .from("loyalty_balances")
      .select("balance, collected")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("passports")
      .select("number, how, issued_at, issued_by")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("loyalty_rewards")
      .select(
        "id, status, reward_label, reward_type, reward_config, stamps_cost, created_at, redeemed_at, note, redeemed:orders!loyalty_rewards_redeemed_order_id_fkey(id, number), source:orders!loyalty_rewards_source_order_id_fkey(id, number)",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    ledgerQuery,
    // Staff names only for staff callers (customers never see who added a stamp).
    opts.staff ? staffNames() : Promise.resolve(new Map<string, string>()),
  ]);
  const entries = toLedger(must(ledger, "loyalty ledger") as unknown as LedgerRow[], names);
  const passportRow = passport.data;
  const by = passportRow?.issued_by ? (names.get(passportRow.issued_by) ?? null) : null;

  return {
    balance: balance.data?.balance ?? 0,
    collected: balance.data?.collected ?? 0,
    passport: passportRow
      ? { number: passportRow.number, how: passportRow.how, issuedAt: passportRow.issued_at, by }
      : null,
    rewards: must(rewards, "loyalty rewards").map((r) => ({
      id: r.id,
      status: r.status,
      label: r.reward_label,
      type: r.reward_type,
      config: (r.reward_config ?? {}) as Record<string, unknown>,
      stampsCost: r.stamps_cost,
      createdAt: r.created_at,
      redeemedAt: r.redeemed_at,
      redeemedOrder: r.redeemed,
      sourceOrder: r.source,
      note: r.note,
    })),
    ledger: entries,
    ledgerTotal: ledger.count ?? entries.length,
  };
}

export type MyPassport =
  | { status: "signed_out" }
  | { status: "no_customer"; email: string }
  | { status: "ok"; name: string; card: CustomerLoyalty };

/**
 * The signed-in customer's passport (request-time: reads the session). Links the auth user to
 * the customer with the same email on first visit; never creates a customer.
 */
export async function getMyPassport(): Promise<MyPassport> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed_out" };
  const { data: customerId, error } = await supabase.rpc("link_customer_account");
  if (error) throw new Error(`passport link failed: ${error.message}`);
  if (!customerId) return { status: "no_customer", email: user.email ?? "" };
  const [{ data: customer }, card] = await Promise.all([
    supabase.from("customers").select("name").eq("id", customerId).maybeSingle(),
    getCustomerLoyalty(customerId, { ledgerLimit: 200 }),
  ]);
  return {
    status: "ok",
    name: customer?.name?.trim().split(/\s+/)[0] || "traveller",
    card,
  };
}

/** Destinations for the manual-stamp dialog (a stamp can carry a destination sticker). */
export async function listDestinations() {
  const supabase = await createClient();
  return must(
    await supabase.from("destinations").select("id, name").eq("active", true).order("sort"),
    "destinations",
  );
}

/** Variants a reward can be taken as (item rewards). */
export async function rewardOptions(rewardId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("loyalty_reward_options", { p_reward_id: rewardId });
  if (error) throw new Error(`reward options failed: ${error.message}`);
  return data ?? [];
}
