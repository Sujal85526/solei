import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const optional = (s: z.ZodType<string, string>) =>
  z
    .string()
    .trim()
    .transform((v) => v || null)
    .pipe(s.nullable());

/**
 * Public contact details (Contact page, footer). Empty fields are hidden on the site — only
 * confirmed business channels are published.
 */
export const contactSchema = z.object({
  contactEmail: optional(z.email("Enter a valid email").toLowerCase()),
  whatsappNumber: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const r = normalizePhone(v);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.error });
        return z.NEVER;
      }
      return r.e164;
    }),
  instagramHandle: optional(
    z
      .string()
      .max(40)
      .transform((v) => (v.startsWith("@") ? v : `@${v}`)),
  ),
  instagramUrl: optional(z.url("Enter a full link, e.g. https://www.instagram.com/solei.ad/")),
});

export type ContactDetails = {
  email: string | null;
  whatsapp: string | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
};
