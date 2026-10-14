import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { cartLineSchema, emirateSchema, MAX_LINES } from "@/modules/cart/schema";

const required = (label: string, max = 120) =>
  z.string().trim().min(1, `Enter your ${label}`).max(max);

/** Guest checkout: name, UAE-format mobile, email, full address and emirate are required (§6.2). */
export const checkoutSchema = z.object({
  clientUuid: z.uuid(),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const r = normalizePhone(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.error });
        return z.NEVER;
      }
      return r.e164;
    }),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  line1: required("street address", 160),
  line2: z.string().trim().max(160).optional().default(""),
  area: required("area", 80),
  city: required("city", 80),
  emirate: emirateSchema,
  notes: z.string().trim().max(500).optional().default(""),
  marketingConsent: z
    .union([z.boolean(), z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === true || v === "on"),
  lines: z.array(cartLineSchema).min(1, "Your cart is empty").max(MAX_LINES),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
