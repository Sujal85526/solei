import { z } from "zod";
import { formatBusinessDate } from "@/lib/dates";
import { aedToFils, formatAED, type Fils } from "@/lib/money";

/**
 * Gift cards: sold online in owner-chosen amounts, the code emailed to the buyer or a person they
 * name, spent as a payment method at checkout and (if the owner allows it) at the till. The
 * database keeps the balance as a ledger and enforces every rule (`gift_card_*` functions);
 * this file is the shared validation and wording.
 */

export type GiftCardSettings = {
  enabled: boolean;
  amountsFils: Fils[];
  /** null = cards never expire. */
  expiryMonths: number | null;
  /** Cards can be spent at the event till too. */
  atPos: boolean;
};

export type GiftCardStatus = "pending" | "active" | "void";
/** What staff see: the stored status plus used up / expired. */
export type GiftCardState = "pending" | "active" | "used" | "expired" | "void";

export const GIFT_CARD_STATE_LABELS: Record<GiftCardState, string> = {
  pending: "Awaiting payment",
  active: "Active",
  used: "Used up",
  expired: "Expired",
  void: "Void",
};

export function giftCardState(
  c: { status: GiftCardStatus; expiresAt: string | null },
  balanceFils: number,
  now = new Date(),
): GiftCardState {
  if (c.status !== "active") return c.status;
  if (c.expiresAt && new Date(c.expiresAt) <= now) return "expired";
  if (balanceFils <= 0) return "used";
  return "active";
}

const CODE_CHARS = /^[A-Z2-9]{12}$/;

/** "abcd efgh-2345" → "ABCD-EFGH-2345"; null when it can't be a code (mirrors gift_card_normalize). */
export function normaliseGiftCode(input: string): string | null {
  const raw = input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (raw.length !== 12) return null;
  if (!CODE_CHARS.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/** "····-····-2345" — enough for a receipt or a summary line. */
export const maskGiftCode = (code: string) => `····-····-${code.slice(-4)}`;

/** Spend as much of the card as the order needs. */
export const giftCardApplies = (balanceFils: Fils, dueFils: Fils): Fils =>
  Math.max(0, Math.min(balanceFils, dueFils));

export type GiftCardRefusal = "invalid" | "not_active" | "void" | "expired" | "empty";

export function giftCardRefusalMessage(reason: GiftCardRefusal): string {
  switch (reason) {
    case "expired":
      return "This gift card has expired.";
    case "empty":
      return "This gift card has no balance left.";
    case "void":
      return "This gift card is no longer valid.";
    case "not_active":
      return "This gift card isn't active yet.";
    default:
      return "We couldn't find that gift card — check the code.";
  }
}

/** "Valid until 24 October 2027." / "" (no expiry). */
export function expiryText(expiresAt: string | null): string {
  return expiresAt
    ? `Valid until ${formatBusinessDate(expiresAt, { day: "numeric", month: "long", year: "numeric" })}.`
    : "";
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((v) => v || null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => v || null)
  .pipe(z.email("Enter a valid email").nullable());

const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .optional()
  .transform((v) => v === true || v === "on");

/** Storefront purchase form. A card for someone else needs their name and email. */
export const giftCardPurchaseSchema = z
  .object({
    clientUuid: z.uuid(),
    amountFils: z.coerce.number().int().positive("Choose an amount"),
    forSomeoneElse: checkbox,
    recipientName: optionalText(80),
    recipientEmail: optionalEmail,
    senderName: optionalText(80),
    message: optionalText(300),
  })
  .superRefine((v, ctx) => {
    if (!v.forSomeoneElse) return;
    if (!v.recipientName)
      ctx.addIssue({ code: "custom", path: ["recipientName"], message: "Enter their name" });
    if (!v.recipientEmail)
      ctx.addIssue({ code: "custom", path: ["recipientEmail"], message: "Enter their email" });
  });
export type GiftCardPurchase = z.output<typeof giftCardPurchaseSchema>;

const aed = (label: string, { allowNegative = false } = {}) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((v, ctx) => {
      const n = Number(v.replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n === 0 || (!allowNegative && n < 0)) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in AED, e.g. 100` });
        return z.NEVER;
      }
      return aedToFils(n);
    });

/** Staff issue a card by hand. */
export const giftCardIssueSchema = z.object({
  amount: aed("an amount"),
  recipientName: optionalText(80),
  recipientEmail: optionalEmail,
  message: optionalText(300),
  note: optionalText(300),
  sendEmail: checkbox,
});

export const giftCardAdjustSchema = z.object({
  id: z.uuid(),
  /** + adds, − takes off. */
  amount: aed("an amount", { allowNegative: true }),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});

export const giftCardVoidSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});

/** Owner settings. Amounts are typed as "100, 200, 500". */
export const giftCardSettingsSchema = z.object({
  enabled: checkbox,
  amounts: z
    .string()
    .trim()
    .min(1, "Enter at least one amount")
    .transform((v, ctx) => {
      const parts = v
        .split(/[,\s]+/)
        .filter(Boolean)
        .map((p) => Number(p));
      if (parts.some((n) => !Number.isFinite(n) || n <= 0)) {
        ctx.addIssue({ code: "custom", message: "Amounts in AED, separated by commas" });
        return z.NEVER;
      }
      const fils = [...new Set(parts.map((n) => aedToFils(n)))].sort((a, b) => a - b);
      if (fils.length > 8) {
        ctx.addIssue({ code: "custom", message: "At most 8 amounts" });
        return z.NEVER;
      }
      return fils;
    }),
  expiryMonths: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isSafeInteger(n) || n < 1 || n > 120) {
        ctx.addIssue({ code: "custom", message: "1 to 120 months, or empty for no expiry" });
        return z.NEVER;
      }
      return n;
    }),
  atPos: checkbox,
});

export const amountsText = (amounts: Fils[]) =>
  amounts.map((f) => formatAED(f).replace(/^AED\s*/, "")).join(", ");

/** Ledger entry wording for the admin history. */
export const LEDGER_LABELS: Record<"issue" | "redeem" | "refund" | "adjust" | "void", string> = {
  issue: "Issued",
  redeem: "Spent",
  refund: "Given back",
  adjust: "Adjusted",
  void: "Voided",
};
