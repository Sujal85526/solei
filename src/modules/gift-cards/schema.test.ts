import { describe, expect, it } from "vitest";
import {
  expiryText,
  giftCardApplies,
  giftCardPurchaseSchema,
  giftCardSettingsSchema,
  giftCardState,
  maskGiftCode,
  normaliseGiftCode,
} from "./schema";

describe("gift card codes", () => {
  it("normalises spaces, dashes and case", () => {
    expect(normaliseGiftCode("abcd efgh-2345")).toBe("ABCD-EFGH-2345");
    expect(normaliseGiftCode("ABCDEFGH2345")).toBe("ABCD-EFGH-2345");
  });

  it("refuses anything that can't be a code", () => {
    expect(normaliseGiftCode("ABCD-EFGH")).toBeNull();
    // 0, 1, O and I are never used.
    expect(normaliseGiftCode("ABCD-EFGH-2340")).toBeNull();
  });

  it("masks all but the last four", () => {
    expect(maskGiftCode("ABCD-EFGH-2345")).toBe("····-····-2345");
  });
});

describe("giftCardApplies", () => {
  it("spends what the order needs, up to the balance", () => {
    expect(giftCardApplies(20_000, 28_000)).toBe(20_000);
    expect(giftCardApplies(50_000, 28_000)).toBe(28_000);
    expect(giftCardApplies(0, 28_000)).toBe(0);
  });
});

describe("giftCardState", () => {
  const now = new Date("2026-10-24T10:00:00Z");
  it("derives used up and expired from an active card", () => {
    const card = { status: "active" as const, expiresAt: "2027-10-24T10:00:00Z" };
    expect(giftCardState(card, 5_000, now)).toBe("active");
    expect(giftCardState(card, 0, now)).toBe("used");
    expect(giftCardState({ ...card, expiresAt: "2026-10-01T00:00:00Z" }, 5_000, now)).toBe(
      "expired",
    );
    expect(giftCardState({ ...card, status: "void" }, 5_000, now)).toBe("void");
  });
});

describe("giftCardPurchaseSchema", () => {
  const base = { clientUuid: crypto.randomUUID(), amountFils: "20000" };
  it("needs their name and email when it's for someone else", () => {
    expect(giftCardPurchaseSchema.safeParse({ ...base, forSomeoneElse: true }).success).toBe(false);
    const ok = giftCardPurchaseSchema.safeParse({
      ...base,
      forSomeoneElse: true,
      recipientName: "Mira",
      recipientEmail: "MIRA@solei.test",
    });
    expect(ok.success && ok.data.recipientEmail).toBe("mira@solei.test");
  });

  it("is fine without a recipient when it's for the buyer", () => {
    const r = giftCardPurchaseSchema.safeParse({ ...base, forSomeoneElse: false });
    expect(r.success && r.data.amountFils).toBe(20_000);
  });
});

describe("giftCardSettingsSchema", () => {
  it("turns an AED list into sorted unique fils", () => {
    const r = giftCardSettingsSchema.safeParse({ amounts: "500, 100 200,100", expiryMonths: "" });
    expect(r.success && r.data.amounts).toEqual([10_000, 20_000, 50_000]);
    expect(r.success && r.data.expiryMonths).toBeNull();
  });

  it("refuses bad amounts and expiry", () => {
    expect(giftCardSettingsSchema.safeParse({ amounts: "100, abc" }).success).toBe(false);
    expect(giftCardSettingsSchema.safeParse({ amounts: "100", expiryMonths: "0" }).success).toBe(
      false,
    );
  });
});

describe("expiryText", () => {
  it("reads as a date in Abu Dhabi, or nothing", () => {
    expect(expiryText("2027-10-23T21:00:00Z")).toBe("Valid until 24 October 2027.");
    expect(expiryText(null)).toBe("");
  });
});
