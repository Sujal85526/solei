"use server";

import { assertPermission } from "@/lib/auth/session";
import { daySummary, type DaySummary } from "./queries";

export async function daySummaryAction(eventId: string): Promise<DaySummary> {
  await assertPermission("pos.use");
  return daySummary(eventId);
}
