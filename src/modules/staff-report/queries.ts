import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StaffPerformanceRow } from "./report";
import { hiddenStaffIds } from "@/modules/staff/hidden";

/** One row per staff member for business days from..to (the database checks reports.view). */
export async function staffPerformance(from: string, to: string): Promise<StaffPerformanceRow[]> {
  const supabase = await createClient();
  const [{ data, error }, hidden] = await Promise.all([
    supabase.rpc("staff_performance", { p_from: from, p_to: to }),
    hiddenStaffIds(),
  ]);
  if (error) throw new Error(error.message);
  return data
    .filter((r) => !hidden.has(r.user_id))
    .map((r) => ({
      userId: r.user_id,
      name: r.full_name,
      jobTitle: r.job_title,
      active: r.active,
      orders: r.orders,
      units: r.units,
      salesFils: r.sales_fils,
      workedMinutes: r.worked_minutes,
      shiftsWorked: r.shifts_worked,
      plannedMinutes: r.planned_minutes,
      plannedShifts: r.planned_shifts,
      eventsWorked: r.events_worked,
    }));
}
