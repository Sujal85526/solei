import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { emirateSchema } from "@/modules/cart/schema";

const email = z.email("Enter a valid email").trim().toLowerCase();

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const r = normalizePhone(v);
    if (!r.ok) {
      ctx.addIssue({ code: "custom", message: r.error });
      return z.NEVER;
    }
    return r.e164;
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

const matches = (v: { password: string; confirm: string }) => v.password === v.confirm;
const mismatch = { path: ["confirm"], message: "Passwords don't match" };

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name").max(40),
    lastName: z.string().trim().min(1, "Enter your last name").max(40),
    phone: phoneSchema,
    email,
    password,
    confirm: z.string(),
  })
  .refine(matches, mismatch);

export const emailOnlySchema = z.object({ email });

export const codeSchema = z.object({
  email,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
});

export const resetSchema = codeSchema
  .extend({ password, confirm: z.string() })
  .refine(matches, mismatch);

/** Saved delivery address (account profile; prefilled at checkout). */
export const addressSchema = z.object({
  line1: z.string().trim().min(1, "Enter your street address").max(160),
  line2: z.string().trim().max(160).optional().default(""),
  area: z.string().trim().min(1, "Enter your area").max(80),
  city: z.string().trim().min(1, "Enter your city").max(80),
  emirate: emirateSchema,
});
export type SavedAddress = z.output<typeof addressSchema>;

export const profileSchema = z.object({
  firstName: signUpSchema.shape.firstName,
  lastName: signUpSchema.shape.lastName,
  phone: phoneSchema,
});

/** The parts of a Supabase user's `user_metadata` the store uses. */
export type AccountMeta = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: SavedAddress;
};
