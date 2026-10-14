import { describe, expect, it } from "vitest";
import { contrastPairs, contrastRatio, palette } from "./palette";

describe("brand palette contrast (WCAG AA)", () => {
  it.each(contrastPairs)("$fg on $bg ($use) ≥ $min", ({ fg, bg, min }) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
  });

  it("confirms pink on cream fails, so it is never used for text", () => {
    expect(contrastRatio(palette.pink, palette.cream)).toBeLessThan(3);
  });

  it("confirms gold on cream fails for small text", () => {
    expect(contrastRatio(palette.gold, palette.cream)).toBeLessThan(4.5);
  });
});
