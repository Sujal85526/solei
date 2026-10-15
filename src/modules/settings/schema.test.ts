import { describe, expect, it } from "vitest";
import { contactSchema } from "./schema";

describe("contact schema", () => {
  it("normalises filled fields and turns empty ones into null", () => {
    const r = contactSchema.parse({
      contactEmail: " Hello@Solei.AE ",
      whatsappNumber: "050 123 4567",
      instagramHandle: "solei.ad",
      instagramUrl: "",
    });
    expect(r).toEqual({
      contactEmail: "hello@solei.ae",
      whatsappNumber: "+971501234567",
      instagramHandle: "@solei.ad",
      instagramUrl: null,
    });
  });

  it("rejects a bad number or link", () => {
    expect(
      contactSchema.safeParse({
        whatsappNumber: "123",
        contactEmail: "",
        instagramHandle: "",
        instagramUrl: "",
      }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({
        whatsappNumber: "",
        contactEmail: "",
        instagramHandle: "",
        instagramUrl: "solei",
      }).success,
    ).toBe(false);
  });
});
