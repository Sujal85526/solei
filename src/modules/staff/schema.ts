import { z } from "zod";
import { PERMISSION_KEYS } from "@/lib/permissions";

export const employmentStatuses = [
  "full_time",
  "part_time",
  "freelance",
  "event_only",
  "former",
] as const;
export const employmentStatusLabels: Record<(typeof employmentStatuses)[number], string> = {
  full_time: "Full time",
  part_time: "Part time",
  freelance: "Freelance",
  event_only: "Events only",
  former: "Former",
};

const optionalText = z
  .string()
  .trim()
  .max(120)
  .transform((v) => v || null)
  .nullable()
  .optional();

export const inviteStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Enter their name").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  roleId: z.uuid("Choose a role"),
  position: optionalText,
  phone: optionalText,
  employmentStatus: z.enum(employmentStatuses).default("full_time"),
});

export const updateStaffSchema = inviteStaffSchema
  .omit({ email: true })
  .extend({ userId: z.uuid() });

export const rolePermissionsSchema = z.object({
  roleId: z.uuid(),
  permissions: z.array(z.enum(PERMISSION_KEYS as [string, ...string[]])),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(2, "Enter a role name").max(40),
  requiresMfa: z.boolean().default(false),
  copyFromRoleId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export function roleKeyFromName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[_0-9]+|_$/g, "")
    .slice(0, 40)
    .replace(/_$/, "");
}
