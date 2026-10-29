import { z } from "zod";
import { Constants } from "@/lib/database.types";

/** Complaints, suggestions and compliments log (customer_feedback). */

export const feedbackKinds = Constants.public.Enums.feedback_kind;
export const feedbackStatuses = Constants.public.Enums.feedback_status;
export type FeedbackKind = (typeof feedbackKinds)[number];
export type FeedbackStatus = (typeof feedbackStatuses)[number];

export const kindLabels: Record<FeedbackKind, string> = {
  complaint: "Complaint",
  suggestion: "Suggestion",
  compliment: "Compliment",
  other: "Other",
};

export const statusLabels: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const statusBadgeVariant = {
  open: "warning",
  in_progress: "secondary",
  resolved: "success",
} as const satisfies Record<FeedbackStatus, string>;

export const kindBadgeVariant = {
  complaint: "destructive",
  suggestion: "secondary",
  compliment: "pink",
  other: "muted",
} as const satisfies Record<FeedbackKind, string>;

export type FeedbackEntry = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  kind: FeedbackKind;
  source: "staff" | "email";
  rating: number | null;
  message: string;
  status: FeedbackStatus;
  assignedTo: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const optionalUuid = z
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Staff add or update an entry (FormData strings). */
export const feedbackFormSchema = z
  .object({
    id: optionalUuid,
    customerId: optionalUuid,
    orderId: optionalUuid,
    kind: z.enum(feedbackKinds, "Choose the kind"),
    message: z.string().trim().min(1, "Write what the customer said").max(2000),
    status: z.enum(feedbackStatuses).default("open"),
    assignedTo: optionalUuid,
    resolution: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || null),
  })
  .refine((v) => v.id || v.customerId || v.orderId, {
    path: ["customerId"],
    message: "Choose the customer",
  });

/** List filters from the URL; unknown values mean "any". */
export type FeedbackFilters = {
  status?: FeedbackStatus;
  kind?: FeedbackKind;
  assigned?: string;
  page: number;
};

export function parseFeedbackFilters(
  sp: Record<string, string | string[] | undefined>,
): FeedbackFilters {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = get("status");
  const kind = get("kind");
  const assigned = get("assigned");
  const page = Number(get("page") ?? 1);
  return {
    status: (feedbackStatuses as readonly string[]).includes(status ?? "")
      ? (status as FeedbackStatus)
      : undefined,
    kind: (feedbackKinds as readonly string[]).includes(kind ?? "")
      ? (kind as FeedbackKind)
      : undefined,
    assigned: assigned === "me" || z.uuid().safeParse(assigned).success ? assigned : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

export function feedbackFiltersToQuery(f: FeedbackFilters, page = f.page) {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.kind) p.set("kind", f.kind);
  if (f.assigned) p.set("assigned", f.assigned);
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

/** "★★★★☆" for a 1–5 rating. */
export const stars = (rating: number) =>
  "★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(Math.max(0, 5 - rating));
