import { describe, expect, it } from "vitest";
import { resetSchema, signUpSchema } from "./schema";

const base = {
  firstName: "Layla",
  lastName: "Ahmed",
  phone: "050 123 4567",
  email: "Layla@Example.com",
  password: "Solei-test-2026",
  confirm: "Solei-test-2026",
};

describe("account schemas", () => {
  it("accepts a sign-up whose passwords match", () => {
    const r = signUpSchema.parse(base);
    expect(r.email).toBe("layla@example.com");
    expect(r.phone).toBe("+971501234567");
  });

  it("rejects a sign-up whose confirmation differs", () => {
    const r = signUpSchema.safeParse({ ...base, confirm: "Solei-test-2027" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["confirm"]);
  });

  it("checks the confirmation on password reset too", () => {
    const ok = { email: "a@b.co", code: "123456", password: "Solei-test-2026" };
    expect(resetSchema.safeParse({ ...ok, confirm: ok.password }).success).toBe(true);
    expect(resetSchema.safeParse({ ...ok, confirm: "nope" }).success).toBe(false);
  });
});
