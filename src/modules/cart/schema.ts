import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { lineOptionsSchema } from "@/modules/catalog/options";

/** Upper bound per line — a sanity cap against tampered storage, not a business rule. */
export const MAX_LINE_QTY = 99;
/** Giveaways come in hundreds (one per guest), so their lines go higher. */
export const MAX_GIVEAWAY_LINE_QTY = 1000;
/** Upper bound on distinct lines in one cart. */
export const MAX_LINES = 50;

export const emirates = Constants.public.Enums.emirate;
export const emirateSchema = z.enum(emirates);
export type Emirate = z.infer<typeof emirateSchema>;

export const cartLineSchema = z
  .object({
    variantId: z.guid(),
    qty: z.int().min(1).max(MAX_GIVEAWAY_LINE_QTY),
    /** Giveaways: the chosen options (absent for ordinary products). */
    options: lineOptionsSchema.optional(),
    /** The giveaway this bottle is bought through (its options are the giveaway's). */
    giveawayId: z.guid().optional(),
  })
  .refine((l) => l.giveawayId || l.qty <= MAX_LINE_QTY, { path: ["qty"] });

/** Most pieces one line may hold. */
export const maxLineQty = (line: { giveawayId?: string }) =>
  line.giveawayId ? MAX_GIVEAWAY_LINE_QTY : MAX_LINE_QTY;
export type CartLine = z.infer<typeof cartLineSchema>;

/** Input of the `getCartDetails` server action. */
export const cartDetailsInputSchema = z.object({
  lines: z.array(cartLineSchema).max(MAX_LINES),
  emirate: emirateSchema.nullish(),
  /** Discount code typed at checkout (website only). */
  coupon: z.string().trim().max(40).nullish(),
  /** Gift card code applied at checkout (signed-in customers). */
  giftCard: z.string().trim().max(40).nullish(),
  /** Spend the signed-in customer's points (when the programme is on). */
  usePoints: z.boolean().nullish(),
});
export type CartDetailsInput = z.infer<typeof cartDetailsInputSchema>;
