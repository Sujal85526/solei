import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { feedbackFormSchema } from "./schema";

/** Add an entry to the log, or update one (status, assignee, resolution, wording). */
export async function saveFeedback(input: unknown): Promise<string> {
  const staff = await assertPermission("customers.manage");
  const v = feedbackFormSchema.parse(input);
  const supabase = await createClient();
  const row = {
    kind: v.kind,
    message: v.message,
    status: v.status,
    assigned_to: v.assignedTo ?? null,
    resolution: v.resolution,
  };
  if (v.id) {
    const { data, error } = await supabase
      .from("customer_feedback")
      .update(row)
      .eq("id", v.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new UserError("This entry no longer exists.");
    return data.id;
  }
  const { data, error } = await supabase
    .from("customer_feedback")
    .insert({
      ...row,
      customer_id: v.customerId ?? null,
      order_id: v.orderId ?? null,
      created_by: staff.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Quick status change from the list. */
export async function setFeedbackStatus(id: string, status: "open" | "in_progress" | "resolved") {
  await assertPermission("customers.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("customer_feedback").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFeedback(id: string) {
  await assertPermission("customers.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("customer_feedback").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
