import { z } from "zod";
import { aedToFils } from "@/lib/money";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes")
  .max(80);

/** Comma/newline separated list → trimmed array. */
const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? "").split(/[,\n]/))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
  );

/** "280" / "280.50" AED → fils; rejects negatives and junk. */
export const aedField = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const raw = typeof v === "number" ? v : v.trim();
  if (raw === "") {
    ctx.addIssue({ code: "custom", message: "Enter an amount" });
    return z.NEVER;
  }
  const n = typeof raw === "number" ? raw : Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount in AED" });
    return z.NEVER;
  }
  return aedToFils(n);
});

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  slug: slug.optional(),
  description: text(400),
  active: checkbox,
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

export const destinationSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name").max(60),
  slug: slug.optional(),
  country: text(60),
  region: text(80),
  mood: text(200),
  story: text(2000),
  accentColour: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex colour like #460328")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  postcardImageUrl: text(500),
  heroImageUrl: text(500),
  active: checkbox,
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

export const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a product name").max(120),
  slug: slug.optional(),
  categoryId: z.uuid("Choose a category"),
  destinationId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: text(4000),
  notesTop: list,
  notesHeart: list,
  notesBase: list,
  active: checkbox,
  featured: checkbox,
  sort: z.coerce.number().int().min(0).max(999).default(0),
});

export const variantSchema = z.object({
  id: z.uuid().optional(),
  productId: z.uuid(),
  label: z.string().trim().max(40).default(""),
  sizeMl: z.coerce
    .number()
    .int()
    .positive("Size must be positive")
    .max(5000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, "SKU: 3–40 letters, numbers or dashes"),
  barcode: text(40),
  price: aedField,
  /** Only applied when the user has reports.financial.view. */
  cost: aedField.optional().or(z.literal("").transform(() => undefined)),
  lowStockThreshold: z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  active: checkbox,
});

export const imageSchema = z.object({
  productId: z.uuid(),
  storagePath: z
    .string()
    .regex(/^products\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/, "Invalid upload path"),
  alt: z.string().trim().max(200).default(""),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type ProductInput = z.input<typeof productSchema>;
export type VariantInput = z.input<typeof variantSchema>;
