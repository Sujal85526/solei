import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { toCsv } from "@/modules/customers/csv";
import { exportCustomers } from "@/modules/customers/queries";
import {
  channelLabel,
  emirateLabels,
  parseCustomerFilters,
  sourceLabels,
  type Emirate,
} from "@/modules/customers/schema";

/** Asia/Dubai calendar date, YYYY-MM-DD (sorts and parses cleanly in spreadsheets). */
const iso = (v: string | null) => (v ? businessDay(new Date(v)) : "");
const aed = (fils: number) => (fils / 100).toFixed(2);

/**
 * CSV of the filtered customer list (same filters as the page). Consent columns are always
 * included so a marketing send can be limited to `marketing_consent = yes`.
 */
export async function GET(request: NextRequest) {
  let staff;
  try {
    staff = await assertPermission("customers.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { page: _page, ...filters } = parseCustomerFilters(request.nextUrl.searchParams);
  const rows = await exportCustomers(filters);
  const withStats = can(staff.permissions, "orders.view");

  const header = [
    "Name",
    "Phone",
    "Email",
    "Emirate",
    "Source",
    ...(withStats ? ["Orders", "Total spent (AED)", "First purchase", "Last purchase"] : []),
    "Marketing consent",
    "Consent channels",
    "Consent recorded",
    "Unsubscribed",
    "Customer since",
  ];
  const body = rows.map((c) => [
    c.name,
    c.phone,
    c.email,
    c.emirate ? emirateLabels[c.emirate as Emirate] : "",
    c.source ? sourceLabels[c.source] : "",
    ...(withStats
      ? [
          c.order_count ?? 0,
          aed(c.total_spent_fils ?? 0),
          iso(c.first_purchase_at),
          iso(c.last_purchase_at),
        ]
      : []),
    c.marketing_consent ? "yes" : "no",
    c.marketing_consent ? (c.marketing_channels ?? []).map(channelLabel).join(" ") : "",
    iso(c.marketing_consent_at),
    iso(c.unsubscribed_at),
    iso(c.created_at),
  ]);

  return new Response(toCsv(header, body), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="solei-customers-${businessDay()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
