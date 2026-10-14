import { IntroLoader } from "@/components/motion/intro-loader";
import { ParallaxFallback } from "@/components/motion/parallax-fallback";
import { DestinationsBand } from "@/components/store/home/destinations-band";
import { Experience } from "@/components/store/home/experience";
import { HeroSlider } from "@/components/store/home/hero-slider";
import { SignatureScents } from "@/components/store/home/signature-scents";
import { StorySplit } from "@/components/store/home/story-split";
import { experienceImages, heroSlides, homeImages } from "@/content/home";
import { listProducts } from "@/modules/storefront/queries";

export default async function HomePage() {
  const products = await listProducts();
  const images = homeImages();
  const featured = [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <>
      <IntroLoader />
      <HeroSlider slides={heroSlides()} />
      {/* The hero stays pinned; everything after it scrolls up over it like a curtain. */}
      <div className="bg-background relative z-10 shadow-[0_-40px_80px_-20px_rgb(0_0_0/0.65)]">
        <StorySplit image={images.soho} />
        <SignatureScents products={featured} />
        <DestinationsBand image={images.window} />
        <Experience images={experienceImages()} />
      </div>
      <ParallaxFallback />
    </>
  );
}
