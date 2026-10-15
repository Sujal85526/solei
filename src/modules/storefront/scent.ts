import type { StoreProduct } from "./types";

export type Accord = { name: string; tier: "top" | "heart" | "base" | null };

const TIERS = ["top", "heart", "base"] as const;

/**
 * Up to three accords for "The scent": the first top, heart and base notes when the catalogue has
 * them; otherwise read from the destination's mood line ("Sparkling lemon, white florals and sea
 * air." → Sparkling lemon · White florals · Sea air), skipping fragments that start with an article.
 */
export function scentAccords(product: Pick<StoreProduct, "notes" | "destination">): Accord[] {
  const fromNotes = TIERS.flatMap((tier) => {
    const name = product.notes[tier][0];
    return name ? [{ name: capitalise(name), tier }] : [];
  });
  if (fromNotes.length) return fromNotes;

  const mood = product.destination?.mood ?? "";
  return (
    mood
      .replace(/[.!]+\s*$/, "")
      .split(/,\s*|\s+and\s+|\s*&\s*/i)
      .map((s) => s.trim())
      // Drop fragments of a longer phrase ("an easy" in "an easy, modern trail").
      .filter((s) => s && !/^(a|an|the)\s/i.test(s))
      .slice(0, 3)
      .map((name) => ({ name: capitalise(name), tier: null }))
  );
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
