import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_test_", "Only Stripe test keys are allowed in Phase 1")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Solei <hello@example.com>"),
});

let cached: z.infer<typeof serverSchema> | undefined;

/** Read lazily so `next build` doesn't need runtime secrets. */
export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
