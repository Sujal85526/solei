import { describe, expect, it } from "vitest";
import { orderToken, verifyOrderToken } from "./order-link";

describe("order links", () => {
  const id = "8d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f";
  it("verifies its own tokens only", () => {
    const t = orderToken(id, "secret-a");
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyOrderToken(id, t, "secret-a")).toBe(true);
    expect(verifyOrderToken(id, t, "secret-b")).toBe(false);
    expect(verifyOrderToken("9d6f0a2e-3a1b-4c55-9e1f-1d2b3c4d5e6f", t, "secret-a")).toBe(false);
    expect(verifyOrderToken(id, "nope", "secret-a")).toBe(false);
    expect(verifyOrderToken(id, null, "secret-a")).toBe(false);
  });
});
