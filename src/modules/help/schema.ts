import { z } from "zod";

export const helpTopicSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Enter a title").max(80),
  updatedLabel: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null),
  body: z.string().max(20000, "Keep it under 20,000 characters"),
  published: z
    .union([z.literal("on"), z.literal(""), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on"),
});

export type HelpTopic = {
  id: string;
  slug: string;
  title: string;
  updatedLabel: string | null;
  body: string;
  sort: number;
  published: boolean;
  updatedAt: string;
};
