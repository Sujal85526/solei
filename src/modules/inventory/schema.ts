import { z } from "zod";

const qty = z.coerce
  .number()
  .int("Whole units only")
  .positive("Enter a quantity above 0")
  .max(100000);

export const receiveSchema = z.object({
  variantId: z.uuid("Choose a product"),
  locationId: z.uuid("Choose a location"),
  qty,
  reason: z.string().trim().max(200).optional(),
});

/** Damage removes stock; a correction can go either way (+ found, − missing). Reason always required. */
export const adjustSchema = z
  .object({
    variantId: z.uuid("Choose a product"),
    locationId: z.uuid("Choose a location"),
    kind: z.enum(["damage", "correction_add", "correction_remove"]),
    qty,
    reason: z.string().trim().min(3, "Say why (e.g. broken in transit, stock count)").max(200),
  })
  .transform((v) => ({
    ...v,
    type: v.kind === "damage" ? ("damage" as const) : ("adjustment" as const),
    signedQty: v.kind === "correction_add" ? v.qty : -v.qty,
  }));

export const transferSchema = z
  .object({
    variantId: z.uuid("Choose a product"),
    fromLocationId: z.uuid("Choose where it comes from"),
    toLocationId: z.uuid("Choose where it goes"),
    qty,
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.fromLocationId !== v.toLocationId, {
    path: ["toLocationId"],
    message: "Choose a different location",
  });

export const locationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name").max(80),
  kind: z.enum(["warehouse", "other"]).default("warehouse"),
  sellsOnline: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
  active: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});

export const movementTypeLabels = {
  receive: "Received",
  sale: "Sold",
  refund_return: "Returned",
  transfer_out: "Transferred out",
  transfer_in: "Transferred in",
  damage: "Damaged",
  adjustment: "Correction",
  reward_redemption: "Reward",
} as const;

/** Low stock when on hand ≤ threshold (variant override, else the business default). */
export function isLowStock(
  onHand: number,
  variantThreshold: number | null,
  defaultThreshold: number,
) {
  return onHand <= (variantThreshold ?? defaultThreshold);
}
