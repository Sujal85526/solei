"use server";

import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { createPublicClient } from "@/lib/supabase/server";

export type TrackResult =
  | { status: "idle" }
  | { status: "not_found" }
  | {
      status: "found";
      order: {
        number: string;
        status: string;
        placedAt: string;
        trackingNumber: string | null;
        courier: string | null;
        totalFils: number;
        paymentStatus: string;
        history: { status: string; at: string }[];
        lines: { name: string; variant: string; qty: number }[];
      };
    };

const schema = z.object({
  number: z.string().trim().min(4).max(20),
  phone: z.string().trim().min(6),
});

/** Public order tracking by number + the phone used on the order (no account needed). */
export async function trackOrderAction(_: TrackResult, fd: FormData): Promise<TrackResult> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "not_found" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone.ok) return { status: "not_found" };
  const { data } = await createPublicClient()
    .rpc("track_order", { p_number: parsed.data.number, p_phone: phone.e164 })
    .maybeSingle();
  if (!data) return { status: "not_found" };
  return {
    status: "found",
    order: {
      number: data.number,
      status: data.status,
      placedAt: data.placed_at,
      trackingNumber: data.tracking_number,
      courier: data.courier,
      totalFils: data.total_fils,
      paymentStatus: data.payment_status,
      history: (data.history as { status: string; at: string }[] | null) ?? [],
      lines: (data.lines as { name: string; variant: string; qty: number }[] | null) ?? [],
    },
  };
}
