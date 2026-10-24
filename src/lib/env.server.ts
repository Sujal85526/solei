import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

const serverSchema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(1),
    PAYMENT_PROVIDER: z.enum(["stripe", "ziina", "mock"]).optional(),
    /** Ziina (client's gateway): API key with write_payment_intents; ZIINA_TEST_MODE=1 for test payments. */
    ZIINA_API_KEY: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    ZIINA_TEST_MODE: z.enum(["0", "1"]).optional(),
    STRIPE_SECRET_KEY: z
      .string()
      .startsWith("sk_test_", "Only Stripe test keys are allowed in Phase 1")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    /** Allow the mock payment page in a production build (CI e2e only). */
    ALLOW_MOCK_PAYMENTS: z.enum(["0", "1"]).optional(),
    MOCK_PAYMENT_SECRET: z.string().optional(),
    ORDER_LINK_SECRET: z.string().optional(),
    /** Signs the "return to your bag" / "stop reminders" links in cart reminder emails. */
    CART_LINK_SECRET: z.string().optional(),
    /** Bearer token the scheduler sends to /api/cron/* (Vercel Cron sets it automatically). */
    CRON_SECRET: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    RESEND_API_KEY: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    /** Non-production: only these recipients (emails or @domains) receive real email. */
    EMAIL_ALLOWLIST: z.string().optional(),
    /** Production switch to send to every customer (set on the live deployment only). */
    EMAIL_ALLOW_ALL: z.enum(["0", "1"]).optional(),
    EMAIL_FROM: z.string().default("Solei <hello@example.com>"),
    /**
     * Testing only, until Resend is set up: a fixed 6-digit code that verifies sign-ups and
     * password resets. Ignored once RESEND_API_KEY is set (real emailed codes take over).
     */
    ACCOUNT_TEST_CODE: z
      .string()
      .regex(/^\d{6}$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .transform((env) => ({
    ...env,
    PAYMENT_PROVIDER:
      env.PAYMENT_PROVIDER ??
      (env.ZIINA_API_KEY ? "ziina" : env.STRIPE_SECRET_KEY ? "stripe" : "mock"),
  }))
  .superRefine((env, ctx) => {
    if (
      env.PAYMENT_PROVIDER === "mock" &&
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build" &&
      env.ALLOW_MOCK_PAYMENTS !== "1"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENT_PROVIDER"],
        message:
          "Mock payments are disabled in production. Configure Stripe or set ALLOW_MOCK_PAYMENTS=1 (CI only).",
      });
    }
  });

let cached: z.infer<typeof serverSchema> | undefined;

/** Read lazily so `next build` doesn't need runtime secrets. */
export function serverEnv() {
  cached ??= serverSchema.parse(process.env);
  return cached;
}

/** Derive a stable secret from the Supabase secret when a dedicated one isn't set. */
function derived(label: string, explicit?: string) {
  if (explicit) return explicit;
  return createHash("sha256").update(`${label}:${serverEnv().SUPABASE_SECRET_KEY}`).digest("hex");
}

export const mockPaymentSecret = () => derived("mock-payments", serverEnv().MOCK_PAYMENT_SECRET);
export const orderLinkSecret = () => derived("order-links", serverEnv().ORDER_LINK_SECRET);
export const cartLinkSecret = () => derived("cart-links", serverEnv().CART_LINK_SECRET);
/** Signs campaign unsubscribe links (same derivation as the cart links). */
export const unsubscribeSecret = () => derived("unsubscribe", serverEnv().CART_LINK_SECRET);
