import "server-only";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { onOrderPaid } from "@/modules/orders/events";
import { posSaleSchema } from "./schema";

export type CompleteSaleResult =
  | { ok: true; orderId: string; number: string; totalFils: number; existing: boolean }
  | { ok: false; error: string; retryable: boolean };

/** Record one POS sale (also used to replay the offline queue — idempotent by clientUuid). */
export async function completeSale(input: unknown): Promise<CompleteSaleResult> {
  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) {
    const badEmail = parsed.error.issues.some((i) => i.path[0] === "customerEmail");
    return {
      ok: false,
      error: badEmail ? "Check the customer's email." : "This sale is incomplete.",
      retryable: false,
    };
  }
  const v = parsed.data;
  let phone: string | undefined;
  if (v.customerPhone) {
    const r = normalizePhone(v.customerPhone);
    if (!r.ok) return { ok: false, error: r.error, retryable: false };
    phone = r.e164;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("pos_complete_sale", {
      p: {
        client_uuid: v.clientUuid,
        event_id: v.eventId,
        sold_at: v.soldAt,
        customer_id: v.customerId ?? null,
        customer_phone: phone ?? null,
        customer_email: v.customerEmail ?? null,
        customer_name: v.customerName ?? null,
        lines: v.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
        payments: v.payments.map((p) => ({
          method: p.method,
          amount_fils: p.amountFils,
          reference: p.reference,
        })),
      },
    })
    .single();
  if (error) {
    const business = ["42501", "P0001", "P0002", "22023"].includes(error.code ?? "");
    const message =
      error.code === "42501"
        ? "You don't have permission to use the POS."
        : error.message.charAt(0).toUpperCase() + error.message.slice(1);
    return { ok: false, error: message, retryable: !business };
  }
  if (!data.existing) await onOrderPaid({ id: data.order_id, number: data.order_number });
  return {
    ok: true,
    orderId: data.order_id,
    number: data.order_number,
    totalFils: data.total_fils,
    existing: data.existing,
  };
}
