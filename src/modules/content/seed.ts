/**
 * Launch catalogue content (from the company profile). Used as the seed source for
 * `supabase/seed.sql` and as a fallback before the database is reachable.
 * Mood lines are placeholder copy — ❓ confirm with the client (docs/DECISIONS.md).
 */

export type SeedDestination = {
  slug: string;
  name: string;
  region: string;
  mood: string;
  story: string;
  accent: string;
  image: string;
  category: "perfume" | "all_over_spray";
};

export const seedDestinations: SeedDestination[] = [
  {
    slug: "cannes",
    name: "Cannes",
    region: "French Riviera",
    mood: "Red carpet evenings, crimson blooms and warm amber.",
    story:
      "Evening light on the Croisette — velvet petals, a glass of something golden and the hum of the festival after dark.",
    accent: "#8C1C2B",
    image: "/images/destinations/cannes.jpg",
    category: "perfume",
  },
  {
    slug: "marbella",
    name: "Marbella",
    region: "Costa del Sol",
    mood: "Sun-ripe oranges and orange blossom in the shade.",
    story:
      "Long lunches under orange trees in the old town, blossom on the breeze and the sea just out of sight.",
    accent: "#C47A2C",
    image: "/images/destinations/marbella.jpg",
    category: "perfume",
  },
  {
    slug: "verona",
    name: "Verona",
    region: "Veneto",
    mood: "Romantic peony, rose and soft vanilla.",
    story:
      "A city of balconies and love letters — pink peonies, rose petals and the sweetness of vanilla.",
    accent: "#C25E78",
    image: "/images/destinations/verona.jpg",
    category: "perfume",
  },
  {
    slug: "capri",
    name: "Capri",
    region: "Amalfi Coast",
    mood: "Sparkling lemon, white florals and sea air.",
    story: "Lemon groves above the Faraglioni, jasmine on whitewashed walls and salt on your skin.",
    accent: "#C9A227",
    image: "/images/destinations/capri.jpg",
    category: "perfume",
  },
  {
    slug: "santorini",
    name: "Santorini",
    region: "Cyclades",
    mood: "Bougainvillea, sun-warmed stone and blue horizons.",
    story:
      "Magenta bougainvillea spilling over blue domes, warm stone underfoot and the Aegean at sunset.",
    accent: "#2F5D8A",
    image: "/images/destinations/santorini.jpg",
    category: "perfume",
  },
  {
    slug: "soho",
    name: "Soho",
    region: "New York",
    mood: "City dusk, skyline glow and an easy, modern trail.",
    story:
      "Rooftops at golden hour, cobbled streets and the electric calm before a night in the city.",
    accent: "#7B3F61",
    image: "/images/destinations/soho.jpg",
    category: "all_over_spray",
  },
  {
    slug: "monaco",
    name: "Monaco",
    region: "Côte d'Azur",
    mood: "Harbour breeze, polished and effortlessly bright.",
    story:
      "Yachts in the harbour, terraces stacked above the sea and a glamour that never tries too hard.",
    accent: "#3C6E91",
    image: "/images/destinations/monaco.jpg",
    category: "all_over_spray",
  },
  {
    slug: "mayfair",
    name: "Mayfair",
    region: "London",
    mood: "White blossom, dark woods and quiet elegance.",
    story:
      "Georgian squares in spring, white blossom against dark railings and the hush of a members' club.",
    accent: "#3E4A3D",
    image: "/images/destinations/mayfair.jpg",
    category: "all_over_spray",
  },
];

export const seedCategories = [
  {
    slug: "perfume",
    name: "Perfumes",
    description: "Eau de parfum in glass bottles with our signature burgundy cap.",
    image: "/images/products/perfumes-trio.jpg",
  },
  {
    slug: "all_over_spray",
    name: "All-over sprays",
    description: "Light, layerable mists for hair and body — 100 ml.",
    image: "/images/products/sprays-stone.jpg",
  },
  {
    slug: "dukhoon",
    name: "Dukhoon",
    description: "Traditional scented incense, coming soon.",
    image: null,
  },
] as const;

/** Launch prices in fils (from the company profile). Editable in admin once the catalog exists. */
export const seedPrices = { perfume: 28_000, all_over_spray: 19_000 } as const;

export const seedEventTypes = [
  "Weddings",
  "Engagements",
  "Birthdays",
  "Graduations",
  "Ramadan & Eid",
  "Family gatherings",
  "Corporate",
] as const;
