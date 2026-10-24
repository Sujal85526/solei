import { z } from "zod";

export const POS_METHODS = ["cash", "card_terminal", "soft_pos", "bank_transfer"] as const;
export type PosMethod = (typeof POS_METHODS)[number];
export const POS_METHOD_LABELS: Record<PosMethod | "gift_card", string> = {
  cash: "Cash",
  card_terminal: "Card terminal",
  soft_pos: "Soft POS",
  bank_transfer: "Bank transfer",
  gift_card: "Gift card",
};
/** Payment methods a sale can carry: the buttons above plus a gift card (code as reference). */
export type PosPaymentMethod = PosMethod | "gift_card";

export const posSaleSchema = z.object({
  clientUuid: z.uuid(),
  eventId: z.uuid(),
  soldAt: z.iso.datetime({ offset: true }),
  customerId: z.uuid().optional(),
  customerPhone: z.string().trim().max(20).optional(),
  /** Links the sale to the customer's online Passport (account email). */
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("Enter a valid email").optional()),
  customerName: z.string().trim().max(80).optional(),
  lines: z
    .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  payments: z
    .array(
      z
        .object({
          method: z.enum([...POS_METHODS, "gift_card"]),
          amountFils: z.number().int().positive(),
          reference: z.string().trim().max(60).optional(),
        })
        .refine((p) => p.method !== "gift_card" || p.reference, "A gift card needs its code"),
    )
    .min(1),
});
export type PosSale = z.infer<typeof posSaleSchema>;

/** Cart total in fils (catalogue prices; VAT-inclusive pricing is the launch default). */
export function cartTotal(lines: { priceFils: number; qty: number }[]) {
  return lines.reduce((s, l) => s + l.priceFils * l.qty, 0);
}

/**
 * Split payment helper: the last row absorbs whatever is left so the split always equals the total.
 * Returns null when the fixed rows already exceed the total.
 */
export function balanceSplit(total: number, fixed: number[]): number | null {
  const used = fixed.reduce((s, n) => s + n, 0);
  return used > total ? null : total - used;
}
