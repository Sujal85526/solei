import { seedCategories, seedPrices } from "@/modules/content/seed";
import type { BookingConfig } from "./types";

/**
 * Launch booking configuration mirroring migration 20261014200001 — only used when
 * CONTENT_FALLBACK=1 (CI builds without a database). Ids are deterministic placeholders.
 */
const fakeId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

export function fallbackBookingConfig(): BookingConfig {
  return {
    eventTypes: [
      "Wedding",
      "Engagement",
      "Birthday",
      "Graduation",
      "Ramadan",
      "Eid",
      "Family gathering",
      "Corporate",
      "Other",
    ].map((name, i) => ({ id: fakeId(i + 1), name })),
    services: [
      ["Perfume display booth", "A styled scent bar where your guests discover every destination."],
      ["Guest giveaways", "Perfumes, all-over sprays and dukhoon your guests take home."],
      ["Customised arrangements", "Florals, trays and details made in your colours."],
    ].map(([name, description], i) => ({ id: fakeId(20 + i), name, description })),
    packages: [
      {
        id: fakeId(30),
        name: "Essence",
        description: "An intimate scent corner for smaller gatherings.",
        inclusions: [
          "Styled tabletop display",
          "One Solei host for up to 3 hours",
          "Testers of the full collection",
          "Delivery & setup in Abu Dhabi",
        ],
        basePriceFils: 350_000,
        images: ["/images/events/booth-table.jpg"],
      },
      {
        id: fakeId(31),
        name: "Signature",
        description: "Our most-loved booth with passports and personalised scent cards.",
        inclusions: [
          "Signature display booth",
          "Two Solei hosts for up to 5 hours",
          "Solei Passport for every guest",
          "Personalised scent cards",
          "Delivery & setup across the UAE",
        ],
        basePriceFils: 650_000,
        images: ["/images/events/booth-passport.jpg"],
      },
      {
        id: fakeId(32),
        name: "Grand Destination",
        description: "A full scent experience for weddings and large celebrations.",
        inclusions: [
          "Grand floral booth",
          "Three Solei hosts for the whole evening",
          "Solei Passport for every guest",
          "Custom giveaway packaging",
          "Fresh florals in your colours",
          "Delivery & setup across the UAE",
        ],
        basePriceFils: 1_200_000,
        images: ["/images/events/booth-florals.jpg"],
      },
    ],
    booths: [
      ["Floral arch", "Blush and burgundy florals framing the collection.", "booth-florals"],
      [
        "Passport bar",
        "A travel-inspired bar where guests collect their stamps.",
        "booth-passport",
      ],
      ["Classic table", "A refined linen table, quiet and elegant.", "booth-table"],
    ].map(([name, description, img], i) => ({
      id: fakeId(40 + i),
      name,
      description,
      photos: [`/images/events/${img}.jpg`],
    })),
    flowers: (
      [
        ["Blush pink", "#F7CDD0", 0],
        ["Ivory white", "#F6EEE8", 0],
        ["Burgundy", "#460328", 15_000],
        ["Gold accents", "#B08D57", 25_000],
        ["Mixed garden", "#C97A86", 30_000],
      ] as const
    ).map(([name, hex, priceFils], i) => ({ id: fakeId(50 + i), name, hex, priceFils })),
    flowerBaseFils: 80_000,
    depositBp: 5000,
    products: seedCategories.map((c) => ({
      category: c.slug,
      name: c.name,
      fromPriceFils: seedPrices[c.slug as keyof typeof seedPrices] ?? null,
    })),
  };
}
