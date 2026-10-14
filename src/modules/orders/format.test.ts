import { describe, expect, it } from "vitest";
import { formatOrderLines, humanize, lineProfit, trackingText } from "./format";

describe("order formatting", () => {
  it("formats lines with variant, quantity and total", () => {
    expect(
      formatOrderLines([
        { product_name: "Capri Perfume", variant_label: "50 ml", qty: 2, line_total_fils: 56000 },
        { product_name: "Soho Spray", variant_label: "", qty: 1, line_total_fils: 19050 },
        {
          product_name: "Mayfair Spray",
          variant_label: "100 ml",
          qty: 1,
          line_total_fils: 0,
          is_reward: true,
        },
      ]),
    ).toBe(
      "2 × Capri Perfume · 50 ml — AED 560\n1 × Soho Spray — AED 190.50\n1 × Mayfair Spray · 100 ml — Reward",
    );
  });

  it("builds the tracking sentence from what is known", () => {
    expect(trackingText("AX123", "Aramex")).toBe("Courier: Aramex · Tracking number: AX123");
    expect(trackingText(" AX123 ", null)).toBe("Tracking number: AX123");
    expect(trackingText(null, "Hand delivery")).toBe("Courier: Hand delivery");
    expect(trackingText("", " ")).toBe("");
  });

  it("humanizes enum keys", () => {
    expect(humanize("abu_dhabi")).toBe("Abu Dhabi");
    expect(humanize(null)).toBe("");
  });

  it("computes line profit and margin in integer fils / basis points", () => {
    expect(lineProfit(28000, 9000, 2)).toEqual({ profitFils: 38000, marginBp: 6786 });
    expect(lineProfit(0, 5500, 1)).toEqual({ profitFils: -5500, marginBp: null });
    expect(lineProfit(28000, null, 1)).toBeNull();
  });
});
