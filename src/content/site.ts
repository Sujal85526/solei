import { FEATURES } from "@/lib/features";

/**
 * The header shows the first three; the menu and footer show all. `soon` pages are listed but
 * locked (shown with a "Coming soon" tag, not linked).
 */
export const storeNav: readonly {
  href: string;
  key:
    | "home"
    | "collections"
    | "events"
    | "giveaways"
    | "story"
    | "passport"
    | "giftCards"
    | "contact";
  soon?: boolean;
}[] = [
  { href: "/", key: "home" },
  { href: "/shop", key: "collections" },
  { href: "/events", key: "events", soon: !FEATURES.bookings },
  { href: "/giveaways", key: "giveaways" },
  { href: "/story", key: "story" },
  { href: "/passport", key: "passport" },
  { href: "/gift-cards", key: "giftCards" },
  { href: "/contact", key: "contact" },
];
