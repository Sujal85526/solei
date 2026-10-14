import "server-only";
import { normalizePhone } from "@/lib/phone";
import { createPublicClient } from "@/lib/supabase/server";
import { optInSchema } from "./schema";

type OptInField = "email" | "phone" | "consent";

export type OptInState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; fieldErrors: Partial<Record<OptInField, string>>; message?: string };

/**
 * Records a marketing opt-in. The `marketing_opt_in` RPC finds or creates the customer by
 * phone/email and stores consent with a timestamp and channel.
 */
export async function recordOptIn(input: unknown): Promise<OptInState> {
  const parsed = optInSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<OptInField, string>> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path[0] as OptInField] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }
  const v = parsed.data;
  const phone =
    v.channel === "whatsapp" ? (normalizePhone(v.phone!) as { e164: string }).e164 : null;
  const email = v.channel === "email" ? v.email!.toLowerCase() : null;

  const { error } = await createPublicClient().rpc("marketing_opt_in", {
    p_channel: v.channel,
    p_email: email ?? undefined,
    p_phone: phone ?? undefined,
  });
  if (error) {
    console.error("marketing_opt_in failed", error);
    return {
      status: "error",
      fieldErrors: {},
      message: "Something went wrong — please try again.",
    };
  }
  return { status: "success" };
}
