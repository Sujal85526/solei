import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, waNumber } from "./phone";

const e164 = (input: string) => {
  const r = normalizePhone(input);
  return r.ok ? r.e164 : null;
};

describe("phone", () => {
  it("normalises every common UAE mobile format to the same E.164", () => {
    for (const input of [
      "0501234567",
      "050 123 4567",
      "501234567",
      "+971501234567",
      "00971 50 123 4567",
      "+971 050 123 4567",
      "(050) 123-4567",
    ]) {
      expect(e164(input)).toBe("+971501234567");
    }
  });

  it("flags UAE mobiles", () => {
    const r = normalizePhone("055 987 6543");
    expect(r.ok && r.isUaeMobile).toBe(true);
    const landline = normalizePhone("02 123 4567");
    expect(landline.ok && landline.isUaeMobile).toBe(false);
  });

  it("accepts international numbers with a prefix", () => {
    expect(e164("+44 7700 900123")).toBe("+447700900123");
  });

  it("rejects invalid numbers", () => {
    expect(e164("")).toBeNull();
    expect(e164("051234567")).toBeNull();
    expect(e164("050-abc")).toBeNull();
    expect(e164("12345")).toBeNull();
  });

  it("formats for display and WhatsApp", () => {
    expect(formatPhone("+971501234567")).toBe("+971 50 123 4567");
    expect(waNumber("+971501234567")).toBe("971501234567");
  });
});
