import { z } from "zod";
import { Constants } from "@/lib/database.types";

/** Upper bound per line — a sanity cap against tampered storage, not a business rule. */
export const MAX_LINE_QTY = 99;
/** Upper bound on distinct lines in one cart. */
export const MAX_LINES = 50;

export const emirates = Constants.public.Enums.emirate;
export const emirateSchema = z.enum(emirates);
export type Emirate = z.infer<typeof emirateSchema>;

export const cartLineSchema = z.object({
  variantId: z.guid(),
  qty: z.int().min(1).max(MAX_LINE_QTY),
});
export type CartLine = z.infer<typeof cartLineSchema>;

/** Input of the `getCartDetails` server action. */
export const cartDetailsInputSchema = z.object({
  lines: z.array(cartLineSchema).max(MAX_LINES),
  emirate: emirateSchema.nullish(),
  /** Discount code typed at checkout (website only). */
  coupon: z.string().trim().max(40).nullish(),
});
export type CartDetailsInput = z.infer<typeof cartDetailsInputSchema>;
