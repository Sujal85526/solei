/** Copy for the Gift cards page (English). */
export const giftCardsCopy = {
  meta: {
    title: "Gift cards",
    description:
      "Give somewhere. A Solei gift card, emailed in moments — to spend on any scent, online or at a Solei pop-up.",
  },
  eyebrow: "Gift cards",
  title: ["Give", "somewhere."],
  lede: "Let them choose their destination. A Solei gift card arrives by email in moments, ready to spend on any scent.",
  amount: "Amount",
  forMe: "For me",
  forSomeoneElse: "For someone else",
  recipientName: "Their name",
  recipientEmail: "Their email",
  senderName: "From",
  message: "Message (optional)",
  messagePlaceholder: "Happy birthday — wherever you go next.",
  buy: (amount: string) => `Buy gift card · ${amount}`,
  buying: "Taking you to secure payment…",
  signIn: "Sign in to buy",
  signInTitle: "Sign in",
  signInNote:
    "Sign in or create an account to buy a gift card — we'll keep the receipt with your orders.",
  delivery: (atPopUps: boolean, expiry: number | null) =>
    [
      "Emailed straight after payment.",
      atPopUps ? "Spend it online or at any Solei pop-up." : "Spend it on our website.",
      expiry ? `Valid for ${expiry} months.` : "It never expires.",
    ].join(" "),
  unavailable: "Gift cards are taking a short break. Please check back soon.",
  cardLabel: "Gift card",
} as const;
