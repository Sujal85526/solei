import { describe, expect, it } from "vitest";
import { stampsLine } from "./welcome-text";

const reward = "a free all-over spray";

describe("stampsLine", () => {
  it("invites a customer with no stickers to start collecting", () => {
    expect(stampsLine({ collected: 0, remaining: 12 }, reward)).toMatch(
      /earns you a sticker — collect them towards a reward/,
    );
  });

  it("tells a customer how many they have and how many are left", () => {
    expect(stampsLine({ collected: 3, remaining: 9 }, reward)).toBe(
      "From your previous orders you've already collected 3 stickers — just 9 more to unlock a free all-over spray.",
    );
  });

  it("uses the singular for one sticker", () => {
    expect(stampsLine({ collected: 1, remaining: 11 }, reward)).toMatch(/collected 1 sticker —/);
  });

  it("congratulates a customer whose card is already full", () => {
    expect(stampsLine({ collected: 12, remaining: 0 }, reward)).toMatch(
      /collected 12 stickers — enough to unlock a free all-over spray/,
    );
  });
});
