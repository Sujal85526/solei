import { describe, expect, it } from "vitest";
import { isHiddenStaffEmail } from "./hidden-list";

describe("isHiddenStaffEmail", () => {
  it("matches the listed emails in any case, and nothing else", () => {
    expect(isHiddenStaffEmail(" RajputSujal098@gmail.com ")).toBe(true);
    expect(isHiddenStaffEmail("cityreachadmin@gmail.com")).toBe(true);
    expect(isHiddenStaffEmail("soleiperfumes@gmail.com")).toBe(false);
    expect(isHiddenStaffEmail(null)).toBe(false);
  });
});
