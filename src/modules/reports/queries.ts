import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import { businessDay } from "@/lib/dates";
import { buildBusinessReport, headline, profitAndLoss, type BusinessFacts } from "./business";
import { previousRange, type DayRange } from "./range";
import type { ReportFacts } from "./types";

/** Events to report on, newest first, with counted orders and units (needs reports.view). */
export async function reportEventOptions() {
  const supabase = await createClient();
  return must(await supabase.rpc("report_event_options"), "report events");
}

export type ReportEventOption = Awaited<ReturnType<typeof reportEventOptions>>[number];

/**
 * Facts for one or more events, in the order asked (unknown ids are skipped). Costs, expenses
 * and the fee are only present when the caller has reports.financial.view — the database
 * function decides, not the caller.
 */
export async function eventReportFacts(ids: string[]): Promise<ReportFacts[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const data = must(await supabase.rpc("event_report_data", { p_event_ids: ids }), "event report");
  return data as unknown as ReportFacts[];
}

/**
 * Facts for the business report between two business days (≤ 366). `detail = false` leaves
 * out customers, months and stock (previous period, dashboard). Costs only with
 * reports.financial.view — decided by the database function.
 */
export async function businessReportFacts(range: DayRange, detail = true): Promise<BusinessFacts> {
  const supabase = await createClient();
  const data = must(
    await supabase.rpc("business_report_data", {
      p_from: range.from,
      p_to: range.to,
      p_detail: detail,
    }),
    "business report",
  );
  return data as unknown as BusinessFacts;
}

/** The business report for a range, compared with the same number of days just before. */
export async function businessReport(range: DayRange) {
  const [facts, prev] = await Promise.all([
    businessReportFacts(range),
    businessReportFacts(previousRange(range), false),
  ]);
  return buildBusinessReport(facts, prev);
}

/**
 * Estimated net profit this month so far (dashboard KPI). Null when the caller can't see
 * financial figures (the database decides) or the report can't be read — the dashboard
 * must still load then (e.g. a preview on a database without the report migration).
 */
export async function monthProfit(today: string = businessDay()) {
  let facts: BusinessFacts;
  try {
    facts = await businessReportFacts({ from: `${today.slice(0, 8)}01`, to: today }, false);
  } catch (e) {
    console.error("dashboard profit KPI:", e);
    return null;
  }
  const { summary } = headline(facts);
  const pnl = profitAndLoss(facts, summary);
  return pnl ? { netProfitFils: pnl.netProfitFils, netMarginBp: pnl.netMarginBp } : null;
}

/** Unit cost per variant (fils). Needs reports.financial.view (RLS on variant_costs). */
export async function variantCosts(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const rows = must(
    await supabase.from("variant_costs").select("variant_id, cost_fils"),
    "variant costs",
  );
  return new Map(rows.map((r) => [r.variant_id, r.cost_fils]));
}
