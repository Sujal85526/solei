/**
 * Fallback site details. Owner-editable values (contact, socials, policies) are read from the
 * `settings` table once it exists; these defaults are used until then and in tests.
 */
export const siteDefaults = {
  instagram: { handle: "@solei.ad", url: "https://www.instagram.com/solei.ad/" },
  email: "hello@solei.ae",
  whatsapp: "", // owner sets their WhatsApp number in Admin → Settings
  city: "Abu Dhabi",
  country: "UAE",
} as const;

/**
 * The header shows the first three; the menu and footer show all. `soon` pages are listed but
 * locked (shown with a "Coming soon" tag, not linked).
 */
export const storeNav: readonly {
  href: string;
  key: "home" | "collections" | "events" | "story" | "destinations" | "passport";
  soon?: boolean;
}[] = [
  { href: "/", key: "home" },
  { href: "/shop", key: "collections" },
  { href: "/events", key: "events", soon: true },
  { href: "/story", key: "story" },
  { href: "/destinations", key: "destinations" },
  { href: "/passport", key: "passport" },
];
