import { z } from "zod";
import { aedField } from "@/modules/catalog/schema";

/** Admin: a product's giveaway settings (Admin → Products → a product → Giveaway). */
export const giveawaySettingsSchema = z.object({
  productId: z.guid(),
  isGiveaway: z.boolean(),
  occasionIds: z.array(z.guid()).max(30),
  items: z
    .array(
      z.object({
        variantId: z.guid(),
        /** Giveaway price per piece in AED; empty = the bottle's own price. */
        price: z.union([z.literal("").transform(() => null), aedField]).nullish(),
        active: z.boolean().default(true),
      }),
    )
    .max(100)
    .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, {
      message: "Each bottle once",
    }),
});
export type GiveawaySettingsInput = z.input<typeof giveawaySettingsSchema>;

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

/** Admin: one occasion (Admin → Products → Occasions). */
export const occasionSchema = z.object({
  id: z.guid().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  blurb: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .nullish(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^(https:\/\/|\/)/.test(v), "Upload a photo or use a /images path")
    .transform((v) => v || null)
    .nullish(),
  storagePath: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || v.startsWith("occasions/"), "Invalid upload path")
    .transform((v) => v || null)
    .nullish(),
  active: checkbox,
  sort: z.coerce.number().int().min(0).max(999).default(0),
});
