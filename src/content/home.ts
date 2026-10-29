import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Homepage editorial content. Client photography lives in public/images/editorial/; until a file is
 * there the brand fallback is used, so the page never breaks while assets are being delivered.
 * (Owner-editable hero slides can move to the database later without changing the components.)
 */
function editorial(file: string, fallback: string) {
  return existsSync(join(process.cwd(), "public", "images", "editorial", file))
    ? `/images/editorial/${file}`
    : fallback;
}

export type HeroContent = {
  image: string;
  alt: string;
  eyebrow: string;
  title: [string, string];
  cta: { label: string; href: string };
  /** object-position for the photo (keep the bottle clear of the copy). */
  focus: string;
};

export function homeImages() {
  return {
    heroBottle: editorial("hero-cannes.jpg", "/images/brand/hero-sprays-arch.jpg"),
    soho: editorial("soho-portrait.jpg", "/images/products/sprays-stone.jpg"),
    window: editorial("sunset-window.jpg", "/images/destinations/monaco.jpg"),
    bag: editorial("solei-bag.jpg", "/images/brand/hero-sprays-arch.jpg"),
    events: editorial("event-booth.jpg", "/images/events/booth-florals.jpg"),
  };
}

/**
 * Signature Scents: which three products are featured. Each shows its product cover photo; the
 * editorial shot here is only used if a product has no photo.
 */
export const featuredShelf = [
  { slug: "capri-perfume", image: "/images/editorial/shelf-capri.jpg" },
  { slug: "marbella-perfume", image: "/images/editorial/shelf-marbella.jpg" },
  { slug: "verona-perfume", image: "/images/editorial/shelf-verona.jpg" },
] as const;

export function heroContent(): HeroContent {
  return {
    image: homeImages().heroBottle,
    alt: "Solei Cannes perfume on a travertine ledge in late-afternoon light",
    eyebrow: "Made to remain.",
    title: ["A destination", "in every scent."],
    cta: { label: "Shop now", href: "/shop" },
    focus: "24% 70%",
  };
}
