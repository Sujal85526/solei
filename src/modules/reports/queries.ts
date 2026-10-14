import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
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
