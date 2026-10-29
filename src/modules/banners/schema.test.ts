import { describe, expect, it } from "vitest";
import { bannerFieldsSchema, createBannerSchema, replaceImageSchema } from "./schema";

const id = "0b9c1f7e-6f0a-4d8e-9a53-2f1d9a4c7e11";

describe("bannerFieldsSchema", () => {
  it("accepts a site path or an https link, or none", () => {
    expect(bannerFieldsSchema.parse({ seconds: "5", linkHref: "/shop" }).linkHref).toBe("/shop");
    expect(bannerFieldsSchema.parse({ seconds: 5, linkHref: "https://x.com/a" }).linkHref).toBe(
      "https://x.com/a",
    );
    expect(bannerFieldsSchema.parse({ seconds: 5, linkHref: "  " }).linkHref).toBeNull();
    expect(bannerFieldsSchema.parse({ seconds: 5 }).linkHref).toBeNull();
  });

  it("rejects protocol-relative and other schemes", () => {
    expect(bannerFieldsSchema.safeParse({ seconds: 5, linkHref: "//evil.com" }).success).toBe(
      false,
    );
    expect(
      bannerFieldsSchema.safeParse({ seconds: 5, linkHref: "javascript:alert(1)" }).success,
    ).toBe(false);
  });

  it("keeps the time between 2 and 60 whole seconds", () => {
    expect(bannerFieldsSchema.safeParse({ seconds: 1 }).success).toBe(false);
    expect(bannerFieldsSchema.safeParse({ seconds: 61 }).success).toBe(false);
    expect(bannerFieldsSchema.safeParse({ seconds: 2.5 }).success).toBe(false);
    expect(bannerFieldsSchema.safeParse({ seconds: "" }).success).toBe(false);
    expect(bannerFieldsSchema.safeParse({ seconds: 2 }).success).toBe(true);
  });
});

describe("upload paths", () => {
  it("only takes files named for their kind", () => {
    const ok = {
      id,
      seconds: 5,
      desktopPath: `${id}/desktop-abc.jpg`,
      mobilePath: `${id}/mobile-abc.webp`,
    };
    expect(createBannerSchema.safeParse(ok).success).toBe(true);
    expect(
      createBannerSchema.safeParse({ ...ok, desktopPath: `${id}/mobile-abc.jpg` }).success,
    ).toBe(false);
    expect(createBannerSchema.safeParse({ ...ok, mobilePath: "../x/mobile-a.jpg" }).success).toBe(
      false,
    );
    expect(
      replaceImageSchema.safeParse({ id, kind: "mobile", path: `${id}/mobile-1.png` }).success,
    ).toBe(true);
  });
});
