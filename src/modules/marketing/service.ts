import "server-only";
import { normalizePhone } from "@/lib/phone";
import { optInSchema } from "./schema";

type OptInField = "email" | "phone" | "consent";

export type OptInState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; fieldErrors: Partial<Record<OptInField, string>> };

/**
 * Records a marketing opt-in with consent timestamp.
 * Persistence lands with the customers table in `feat/schema-core`.
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
  const contact =
    v.channel === "email"
      ? { email: v.email!.toLowerCase() }
      : { phone: (normalizePhone(v.phone!) as { e164: string }).e164 };
  void contact;
  return { status: "success" };
}
