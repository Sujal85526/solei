import { z } from "zod";
import { Constants } from "@/lib/database.types";
import { lineOptionsSchema } from "@/modules/catalog/options";
import { MANUAL_PAYMENT_METHODS } from "./status";

export const manualLineSchema = z.object({
  variantId: z.uuid(),
  qty: z.coerce.number().int().min(1, "At least 1").max(999),
  unitPriceFils: z.coerce.number().int().min(0),
  listPriceFils: z.coerce.number().int().min(0),
  overrideReason: z.string().trim().max(200).optional().default(""),
});

export const manualOrderSchema = z
  .object({
    clientUuid: z.uuid(),
    channel: z.enum(["whatsapp", "instagram", "direct"]),
    customerId: z.uuid("Choose a customer"),
    fulfilment: z.enum(["handed_over", "pickup", "delivery"]),
    deliveryAddress: z
      .object({
        line1: z.string().trim().max(160).default(""),
        line2: z.string().trim().max(160).default(""),
        area: z.string().trim().max(80).default(""),
        city: z.string().trim().max(80).default(""),
      })
      .optional(),
    deliveryEmirate: z.enum(Constants.public.Enums.emirate).optional(),
    deliveryFeeFils: z.coerce.number().int().min(0).default(0),
    notes: z.string().trim().max(500).optional().default(""),
    lines: z.array(manualLineSchema).max(50),
    /** Giveaways: bottle + choices; the database prices them (no price changes here). */
    giveawayLines: z
      .array(
        z.object({
          variantId: z.uuid(),
          qty: z.coerce.number().int().min(1).max(1000),
          options: lineOptionsSchema.optional(),
          giveawayId: z.uuid(),
        }),
      )
      .max(20)
      .default([]),
    payment: z.object({
      mode: z.enum(["later", "full", "partial"]),
      method: z.enum(MANUAL_PAYMENT_METHODS).default("cash"),
      amountFils: z.coerce.number().int().min(0).default(0),
      reference: z.string().trim().max(80).optional().default(""),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.lines.length + v.giveawayLines.length === 0) {
      ctx.addIssue({ code: "custom", path: ["lines"], message: "Add at least one product" });
    }
    v.lines.forEach((l, i) => {
      if (l.unitPriceFils !== l.listPriceFils && l.overrideReason.length < 3) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "overrideReason"],
          message: "Say why the price changed",
        });
      }
    });
    if (v.fulfilment === "delivery") {
      if (!v.deliveryAddress?.line1 || !v.deliveryAddress.area) {
        ctx.addIssue({
          code: "custom",
          path: ["deliveryAddress"],
          message: "Enter the delivery address",
        });
      }
      if (!v.deliveryEmirate)
        ctx.addIssue({ code: "custom", path: ["deliveryEmirate"], message: "Choose the emirate" });
    }
    if (v.payment.mode === "partial" && v.payment.amountFils <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["payment", "amountFils"],
        message: "Enter the amount received",
      });
    }
  });

export type ManualOrderInput = z.input<typeof manualOrderSchema>;

/** Prefilled WhatsApp text for a payment link. */
export function paymentLinkMessage(p: {
  name: string | null;
  number: string;
  amount: string;
  url: string;
}) {
  const hello = p.name ? `Hello ${p.name.split(" ")[0]},` : "Hello,";
  return `${hello} here is your secure payment link for Solei order ${p.number} (${p.amount}):\n${p.url}\n\nThank you — Solei`;
}

export function waLink(e164: string | null | undefined, text: string) {
  const number = (e164 ?? "").replace(/^\+/, "");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
