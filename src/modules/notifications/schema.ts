import { z } from "zod";

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

const key = z.string().regex(/^[a-z_]+$/, "Unknown template");

export const templateSchema = z.object({
  key,
  subject: z.string().trim().min(3, "Enter a subject").max(200, "Keep the subject short"),
  body: z.string().trim().min(10, "Write the email").max(5000, "Keep it under 5000 characters"),
  enabled: checkbox,
});

export const toggleSchema = z.object({ key, enabled: z.boolean() });

export const testSendSchema = templateSchema.pick({ key: true, subject: true, body: true });

export const ownerEmailSchema = z.object({
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v || null),
});

export const outboxFiltersSchema = z.object({
  status: z.enum(["sent", "failed", "skipped"]).optional().catch(undefined),
  template: key.optional().catch(undefined),
  q: z.string().trim().max(120).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});
export type OutboxFilters = z.infer<typeof outboxFiltersSchema>;
