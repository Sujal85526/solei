import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter your email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
  factorId: z.string().min(1),
});

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[a-zA-Z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export const emailSchema = z.object({
  email: z.email("Enter your email address").trim().toLowerCase(),
});

/** Only allow redirects to our own admin pages. */
export function safeAdminPath(next: string | null | undefined, fallback = "/admin"): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\"))
    return fallback;
  return next;
}

export function safeLocalPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\"))
    return fallback;
  return next;
}

/**
 * Where staff password emails (reset, invite) land: /auth/callback signs the link in — any
 * device, since these links carry their own tokens — then opens "Choose a password". Linking to
 * /admin/set-password directly bounced to the login page (no session yet).
 */
export const STAFF_PASSWORD_LINK_PATH = "/auth/callback?next=%2Fadmin%2Fset-password";
