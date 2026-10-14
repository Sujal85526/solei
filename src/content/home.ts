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

export type HeroSlide = {
  image: string;
  alt: string;
  eyebrow: string;
  title: [string, string];
  cta: { label: string; href: string };
  /** object-position for the photo (keep the product clear of the copy). */
  focus: string;
};

export function homeImages() {
  return {
    heroBottle: editorial("hero-cannes.jpg", "/images/brand/hero-sprays-arch.jpg"),
    soho: editorial("soho-portrait.jpg", "/images/products/sprays-stone.jpg"),
    window: editorial("sunset-window.jpg", "/images/destinations/monaco.jpg"),
    booth: editorial("event-booth.jpg", "/images/events/booth-florals.jpg"),
  };
}

export function heroSlides(): HeroSlide[] {
  const img = homeImages();
  return [
    {
      image: img.heroBottle,
      alt: "Solei Cannes perfume on a travertine ledge in late-afternoon light",
      eyebrow: "Made to remain.",
      title: ["Fragrances inspired", "by destinations."],
      cta: { label: "Shop now", href: "/shop" },
      focus: "30% 60%",
    },
    {
      image: img.soho,
      alt: "A woman holding the Solei Soho all-over spray",
      eyebrow: "The all-over spray",
      title: ["A destination", "in every scent."],
      cta: { label: "Discover Soho", href: "/products/soho-all-over-spray" },
      focus: "40% 40%",
    },
    {
      image: img.window,
      alt: "Sunset over the sea through an open window with linen curtains",
      eyebrow: "Private events",
      title: ["Bring Solei", "to your celebration."],
      cta: { label: "Plan your event", href: "/events" },
      focus: "70% 50%",
    },
  ];
}
