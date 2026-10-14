import { describe, expect, it } from "vitest";
import { optInSchema } from "./schema";

describe("opt-in schema", () => {
  it("requires explicit consent", () => {
    const r = optInSchema.safeParse({ channel: "email", email: "a@b.co", consent: false });
    expect(r.success).toBe(false);
  });

  it("validates the field for the chosen channel", () => {
    expect(optInSchema.safeParse({ channel: "email", email: "nope", consent: true }).success).toBe(
      false,
    );
    expect(
      optInSchema.safeParse({ channel: "email", email: "hello@solei.ae", consent: true }).success,
    ).toBe(true);
    expect(
      optInSchema.safeParse({ channel: "whatsapp", phone: "050 123 4567", consent: true }).success,
    ).toBe(true);
    expect(
      optInSchema.safeParse({ channel: "whatsapp", phone: "123", consent: true }).success,
    ).toBe(false);
  });
});
