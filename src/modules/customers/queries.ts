import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import type { CustomerFilters } from "./schema";
import { customerSearchFilter, parseCustomerSearch } from "./search";

export const CUSTOMERS_PAGE_SIZE = 25;
/** CSV export upper bound (fetched in pages of EXPORT_CHUNK). */
export const EXPORT_MAX_ROWS = 20_000;
const EXPORT_CHUNK = 1000;

const SUMMARY_COLUMNS =
  "id, name, phone, email, emirate, source, marketing_consent, marketing_consent_at, marketing_channels, unsubscribed_at, created_at, order_count, total_spent_fils, first_purchase_at, last_purchase_at, label";

type Client = Awaited<ReturnType<typeof createClient>>;

function filteredSummary(supabase: Client, f: Omit<CustomerFilters, "page">, count?: "exact") {
  let q = supabase.from("customer_summary").select(SUMMARY_COLUMNS, count ? { count } : undefined);
  const search = parseCustomerSearch(f.q);
  if (search) q = q.or(customerSearchFilter(search));
  if (f.consent) q = q.eq("marketing_consent", f.consent === "yes");
  if (f.source) q = q.eq("source", f.source);
  if (f.emirate) q = q.eq("emirate", f.emirate);
  if (f.orders === "yes") q = q.gt("order_count", 0);
  if (f.orders === "no") q = q.eq("order_count", 0);
  if (f.label) q = q.eq("label", f.label);

  switch (f.sort) {
    case "spent":
      q = q.order("total_spent_fils", { ascending: false });
      break;
    case "name":
      q = q.order("name", { ascending: true, nullsFirst: false });
      break;
    case "newest":
      q = q.order("created_at", { ascending: false });
      break;
    default:
      q = q.order("last_purchase_at", { ascending: false, nullsFirst: false });
  }
  // Stable order for pagination.
  return q.order("created_at", { ascending: false }).order("id");
}

export type CustomerSummaryRow = Awaited<ReturnType<typeof listCustomers>>["rows"][number];

export async function listCustomers(f: CustomerFilters) {
  const supabase = await createClient();
  const page = Math.max(1, f.page);
  const res = await filteredSummary(supabase, f, "exact").range(
    (page - 1) * CUSTOMERS_PAGE_SIZE,
    page * CUSTOMERS_PAGE_SIZE - 1,
  );
  return { rows: must(res, "customers"), total: res.count ?? 0, page };
}

/** Every row matching the filters (for CSV export), fetched in chunks. */
export async function exportCustomers(f: Omit<CustomerFilters, "page">) {
  const supabase = await createClient();
  const rows: CustomerSummaryRow[] = [];
  for (let from = 0; from < EXPORT_MAX_ROWS; from += EXPORT_CHUNK) {
    const chunk = must(
      await filteredSummary(supabase, f).range(from, from + EXPORT_CHUNK - 1),
      "customer export",
    );
    rows.push(...chunk);
    if (chunk.length < EXPORT_CHUNK) break;
  }
  return rows;
}

/** Compact results for the CustomerPicker (top matches by recent activity). */
export async function searchCustomerOptions(q: string, limit = 8) {
  const search = parseCustomerSearch(q);
  if (!search) return [];
  const supabase = await createClient();
  const rows = must(
    await supabase
      .from("customer_summary")
      .select("id, name, phone, email, emirate, marketing_consent, order_count")
      .or(customerSearchFilter(search))
      .order("last_purchase_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    "customer search",
  );
  return rows.flatMap((r) => (r.id ? [toOption(r)] : []));
}

/** What the picker hands to its consumer — enough to attach a customer to an order. */
export type CustomerOption = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  emirate: string | null;
  marketingConsent: boolean;
  orderCount: number;
};

export function toOption(r: {
  id: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  emirate: string | null;
  marketing_consent: boolean | null;
  order_count?: number | null;
}): CustomerOption {
  return {
    id: r.id ?? "",
    name: r.name,
    phone: r.phone,
    email: r.email,
    emirate: r.emirate,
    marketingConsent: Boolean(r.marketing_consent),
    orderCount: r.order_count ?? 0,
  };
}

export async function getCustomer(id: string) {
  const supabase = await createClient();
  const [customer, summary] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, name, phone, email, emirate, address, marketing_consent, marketing_consent_at, marketing_channels, unsubscribed_at, source, notes, auth_user_id, birth_month, birth_day, event_news, event_news_at, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("customer_summary")
      .select("order_count, total_spent_fils, first_purchase_at, last_purchase_at, label")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (customer.error) throw new Error(`customer failed: ${customer.error.message}`);
  if (!customer.data) return null;
  return {
    customer: customer.data,
    stats: {
      orderCount: summary.data?.order_count ?? 0,
      totalSpentFils: summary.data?.total_spent_fils ?? 0,
      firstPurchaseAt: summary.data?.first_purchase_at ?? null,
      lastPurchaseAt: summary.data?.last_purchase_at ?? null,
      label: summary.data?.label ?? null,
    },
  };
}

/** Every order of the customer across channels, newest first, with derived payment status. */
export async function customerOrders(customerId: string) {
  const supabase = await createClient();
  const orders = must(
    await supabase
      .from("admin_orders")
      .select(
        "id, number, channel, status, placed_at, total_fils, event_name, payment_status, paid_fils, refunded_fils, outstanding_fils",
      )
      .eq("customer_id", customerId)
      .order("placed_at", { ascending: false })
      .limit(500),
    "customer orders",
  );
  return orders.flatMap((o) =>
    o.id && o.number && o.channel && o.status && o.placed_at
      ? [
          {
            id: o.id,
            number: o.number,
            channel: o.channel,
            status: o.status,
            placedAt: o.placed_at,
            totalFils: o.total_fils ?? 0,
            eventName: o.event_name,
            paymentStatus: o.payment_status ?? "pending",
            paidFils: o.paid_fils ?? 0,
            refundedFils: o.refunded_fils ?? 0,
            outstandingFils: o.outstanding_fils ?? 0,
          },
        ]
      : [],
  );
}
export type CustomerOrderRow = Awaited<ReturnType<typeof customerOrders>>[number];
