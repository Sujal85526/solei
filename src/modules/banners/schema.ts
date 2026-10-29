import { z } from "zod";

/** The most banners the rotation holds — more than this and visitors never reach the last ones. */
export const MAX_BANNERS = 8;

export const bannerKinds = ["desktop", "mobile"] as const;
export type BannerKind = (typeof bannerKinds)[number];

const link = z
  .string()
  .trim()
  .max(300)
  .default("")
  .transform((v) => v || null)
  .refine(
    (v) => v === null || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v),
    "Use a page on the site like /shop, or a full https:// link",
  );

/** What the owner types for a banner (everything except the pictures). */
export const bannerFieldsSchema = z.object({
  alt: z.string().trim().max(200).default(""),
  linkHref: link,
  seconds: z.coerce
    .number("Enter the seconds")
    .int("Whole seconds only")
    .min(2, "At least 2 seconds")
    .max(60, "At most 60 seconds"),
});

const pathOf = (kind: string) => new RegExp(`^[0-9a-f-]{36}/${kind}-[A-Za-z0-9._-]+$`);

export const createBannerSchema = bannerFieldsSchema.extend({
  id: z.uuid(),
  desktopPath: z.string().regex(pathOf("desktop"), "Invalid upload"),
  mobilePath: z.string().regex(pathOf("mobile"), "Invalid upload"),
});

export const updateBannerSchema = bannerFieldsSchema.extend({ id: z.uuid() });

export const replaceImageSchema = z.object({
  id: z.uuid(),
  kind: z.enum(bannerKinds),
  path: z.string().regex(/^[0-9a-f-]{36}\/(desktop|mobile)-[A-Za-z0-9._-]+$/, "Invalid upload"),
});

export type Banner = {
  id: string;
  desktopUrl: string;
  mobileUrl: string;
  alt: string;
  href: string | null;
  seconds: number;
};
