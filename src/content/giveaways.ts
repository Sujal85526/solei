/** Copy for the Giveaways pages and the guided giveaway flow (English). */
export const giveawaysCopy = {
  meta: {
    title: "Giveaways & occasions",
    description:
      "Personalised Solei perfumes and all-over sprays for weddings, graduations, Ramadan, Eid and every celebration — in your packaging, with your names.",
  },
  eyebrow: "Giveaways",
  title: "Gifts for every guest",
  lede: "Choose the bottle, the scent and the packaging; add your names. We prepare every piece in Abu Dhabi.",
  occasions: "Occasions",
  all: "All occasions",
  noResults: "No giveaways for this occasion yet — ask us and we'll make one for you.",
  viewAll: "See all giveaways",
  contact: "Ask us",
  from: "From",
  minPieces: (n: number) => `Minimum ${n} pieces`,
  customise: "Customise",
  // Guided flow
  steps: {
    type: "Choose the product",
    scent: "Choose the scent",
    quantity: "How many pieces?",
    personalise: "Personalisation & special requests",
  },
  stepLabel: (n: number, title: string) => `${n} · ${title}`,
  soldOut: "Sold out",
  fewLeft: (n: number) => `${n} left`,
  quantityHint: (min: number, max: number) =>
    max >= min ? `Minimum ${min} pieces · up to ${max} available now` : `Minimum ${min} pieces`,
  notEnough: (available: number) =>
    `Only ${available} available right now — lower the quantity or choose another scent.`,
  each: "each",
  total: "Total",
  includesChoices: "Includes your packaging and personalisation choices.",
  addToBag: "Add to bag",
  buyNow: "Add & check out",
  checking: "Checking stock…",
  added: "Added to your bag",
} as const;
