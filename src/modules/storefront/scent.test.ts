import { describe, expect, it } from "vitest";
import { scentAccords } from "./scent";

const destination = (mood: string) => ({
  slug: "x",
  name: "X",
  region: "",
  mood,
  accent: null,
});
const noNotes = { top: [], heart: [], base: [] };

describe("scent accords", () => {
  it("uses the first note of each tier when the catalogue has notes", () => {
    expect(
      scentAccords({
        notes: { top: ["bergamot", "lemon"], heart: ["white florals"], base: ["amber"] },
        destination: destination("ignored"),
      }),
    ).toEqual([
      { name: "Bergamot", tier: "top" },
      { name: "White florals", tier: "heart" },
      { name: "Amber", tier: "base" },
    ]);
  });

  it("reads accords from the destination mood otherwise", () => {
    expect(
      scentAccords({
        notes: noNotes,
        destination: destination("Sparkling lemon, white florals and sea air."),
      }).map((a) => a.name),
    ).toEqual(["Sparkling lemon", "White florals", "Sea air"]);
    expect(
      scentAccords({
        notes: noNotes,
        destination: destination("Sun-ripe oranges and orange blossom in the shade."),
      }).map((a) => a.name),
    ).toEqual(["Sun-ripe oranges", "Orange blossom in the shade"]);
  });

  it("skips fragments of a longer phrase", () => {
    expect(
      scentAccords({
        notes: noNotes,
        destination: destination("City dusk, skyline glow and an easy, modern trail."),
      }).map((a) => a.name),
    ).toEqual(["City dusk", "Skyline glow", "Modern trail"]);
  });

  it("is empty without notes or a mood", () => {
    expect(scentAccords({ notes: noNotes, destination: null })).toEqual([]);
  });
});
