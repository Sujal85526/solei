import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { cartLineSchema, emirateSchema, MAX_LINES } from "@/modules/cart/schema";

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

const required = (label: string, max = 120) =>
  z.string().trim().min(1, `Enter your ${label}`).max(max);

/**
 * Checkout (signed-in customers): name, UAE-format mobile, full address and emirate are required
 * (§6.2). The email comes from the account; first and last name are joined into `name`.
 */
export const checkoutSchema = z.object({
  clientUuid: z.uuid(),
  firstName: z.string().trim().min(1, "Enter your first name").max(40),
  lastName: z.string().trim().max(40).optional().default(""),
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
  marketingConsent: checkbox,
  saveAddress: checkbox,
  /** Discount code applied in the order summary (checked again server-side). */
  coupon: z.string().trim().max(40).optional().default(""),
  lines: z.array(cartLineSchema).min(1, "Your cart is empty").max(MAX_LINES),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;

export const fullName = (v: { firstName: string; lastName: string }) =>
  [v.firstName, v.lastName].filter(Boolean).join(" ");
export type CheckoutData = z.output<typeof checkoutSchema>;
