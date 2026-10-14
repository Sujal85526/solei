import type { TemplateVars } from "./render";

/**
 * Example values for previews and test sends, so the owner sees a realistic email while editing.
 * Unknown variables fall back to a visible placeholder.
 */
export function sampleVars(siteUrl: string, variables: readonly string[] = []): TemplateVars {
  const known: TemplateVars = {
    customer_name: "Layla Al Mansoori",
    customer_phone: "+971 50 123 4567",
    order_number: "SOL-001234",
    order_lines: "2 × Capri Perfume · 50 ml — AED 560\n1 × Soho All-Over Spray · 100 ml — AED 190",
    order_total: "AED 750",
    order_link: `${siteUrl}/track`,
    amount: "AED 300",
    outstanding: "AED 450",
    tracking: "Courier: Aramex · Tracking number: 1234567890",
    channel: "Website",
    delivery_area: "Abu Dhabi",
    admin_link: `${siteUrl}/admin`,
    booking_ref: "BK-0042",
    event_date: "12 Dec 2026",
    quote_total: "AED 4,500",
    quote_link: `${siteUrl}/events`,
    destination: "Capri",
    stamps: 8,
    stamps_for_reward: 12,
    remaining: 4,
    reward: "a free all-over spray",
    passport_link: `${siteUrl}/passport`,
    product: "Capri Perfume · 50 ml",
    sku: "SOL-P-CAP-50",
    on_hand: 4,
    threshold: 5,
  };
  const vars: TemplateVars = { ...known };
  for (const v of variables) if (!(v in vars)) vars[v] = `[${v}]`;
  return vars;
}
