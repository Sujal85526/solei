import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import type { DashboardSummary } from "./types";

/** Everything on the dashboard in one round trip; the database trims it to the caller's permissions. */
export async function dashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const data = must(await supabase.rpc("dashboard_summary"), "dashboard");
  return data as unknown as DashboardSummary;
}
