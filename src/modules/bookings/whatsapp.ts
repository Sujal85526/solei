import { formatAED } from "@/lib/money";
import { waNumber } from "@/lib/phone";

/** Click-to-chat link with prefilled text (Phase 1 WhatsApp: no API, staff send it themselves). */
export function waLink(e164: string, text: string): string {
  return `https://wa.me/${waNumber(e164)}?text=${encodeURIComponent(text)}`;
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export const waTexts = {
  greeting: (name: string, ref: string) =>
    `Hello ${first(name)}, this is Solei about your event request ${ref}. `,
  quote: (name: string, ref: string, totalFils: number, link: string) =>
    `Hello ${first(name)}, your Solei quotation for ${ref} is ready: ${formatAED(totalFils)}. ` +
    `You can view and accept it here: ${link}`,
  payment: (name: string, ref: string, amountFils: number, label: string, link: string) =>
    `Hello ${first(name)}, here is the secure payment link for the ${label} of your Solei event ` +
    `${ref} (${formatAED(amountFils)}): ${link}`,
};
