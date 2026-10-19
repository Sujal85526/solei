import { describe, expect, it } from "vitest";
import { authorName, averageRating, reviewInputSchema } from "./schema";

describe("reviews", () => {
  it("shows first name and last initial, never the email", () => {
    expect(authorName("Reem", "Alnaqbi")).toBe("Reem A.");
    expect(authorName(" Reem ", "")).toBe("Reem");
    expect(authorName("", "X")).toBe("Solei customer");
    expect(authorName(null, null)).toBe("Solei customer");
  });

  it("averages to one decimal", () => {
    expect(averageRating([5, 4, 4])).toBe(4.3);
    expect(averageRating([])).toBe(0);
  });

  it("needs stars and a sentence, at most 3 photos", () => {
    const base = {
      productId: "6f1d2a8e-1c1b-4a4e-9a4b-2b9f0b1c2d3e",
      rating: 5,
      body: "Lovely and warm.",
    };
    expect(reviewInputSchema.safeParse(base).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...base, rating: 0 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, body: "ok" }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...base, photos: ["a", "b", "c", "d"] }).success).toBe(
      false,
    );
  });
});
