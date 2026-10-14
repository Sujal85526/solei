import { describe, expect, it } from "vitest";
import { passwordSchema, safeAdminPath, safeLocalPath, totpCodeSchema } from "./schema";

describe("auth schema", () => {
  it("only redirects to admin paths", () => {
    expect(safeAdminPath("/admin/orders?x=1")).toBe("/admin/orders?x=1");
    expect(safeAdminPath("https://evil.com")).toBe("/admin");
    expect(safeAdminPath("//evil.com/admin")).toBe("/admin");
    expect(safeAdminPath("/shop")).toBe("/admin");
    expect(safeLocalPath("/passport")).toBe("/passport");
    expect(safeLocalPath("/\\evil.com")).toBe("/");
  });

  it("validates TOTP codes", () => {
    expect(totpCodeSchema.safeParse({ code: "123456", factorId: "f" }).success).toBe(true);
    expect(totpCodeSchema.safeParse({ code: "12345", factorId: "f" }).success).toBe(false);
  });

  it("requires strong matching passwords", () => {
    expect(passwordSchema.safeParse({ password: "short1", confirm: "short1" }).success).toBe(false);
    expect(
      passwordSchema.safeParse({ password: "longenough", confirm: "longenough" }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ password: "longenough1", confirm: "different11" }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ password: "longenough1", confirm: "longenough1" }).success,
    ).toBe(true);
  });
});
