import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { HIDDEN_STAFF_EMAILS } from "./hidden-list";

/** User ids of the hidden staff logins (see `hidden-list.ts`), looked up once per request. */
export const hiddenStaffIds = cache(async (): Promise<Set<string>> => {
  const { data } = await createAdminClient()
    .from("staff_profiles")
    .select("user_id")
    .in("email", [...HIDDEN_STAFF_EMAILS]);
  return new Set((data ?? []).map((s) => s.user_id));
});
