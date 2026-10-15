/**
 * The header shows the first three; the menu and footer show all. `soon` pages are listed but
 * locked (shown with a "Coming soon" tag, not linked).
 */
export const storeNav: readonly {
  href: string;
  key: "home" | "collections" | "events" | "story" | "passport" | "contact";
  soon?: boolean;
}[] = [
  { href: "/", key: "home" },
  { href: "/shop", key: "collections" },
  { href: "/events", key: "events", soon: true },
  { href: "/story", key: "story" },
  { href: "/passport", key: "passport" },
  { href: "/contact", key: "contact" },
];
