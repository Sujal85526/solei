import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const optInChannels = ["email", "whatsapp"] as const;

/** Newsletter / WhatsApp opt-in. Consent must be an explicit, affirmative tick. */
export const optInSchema = z
  .object({
    channel: z.enum(optInChannels),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    consent: z.literal(true, { error: "Please tick the box to agree to hear from us" }),
  })
  .superRefine((v, ctx) => {
    if (v.channel === "email") {
      if (!v.email || !z.email().safeParse(v.email).success) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address" });
      }
    } else {
      const r = normalizePhone(v.phone ?? "");
      if (!r.ok) ctx.addIssue({ code: "custom", path: ["phone"], message: r.error });
    }
  });

export type OptInInput = z.input<typeof optInSchema>;
