import { IntroLoader } from "@/components/motion/intro-loader";
import { ParallaxFallback } from "@/components/motion/parallax-fallback";
import { DestinationsBand } from "@/components/store/home/destinations-band";
import { Experience } from "@/components/store/home/experience";
import { HeroSlider } from "@/components/store/home/hero-slider";
import { SignatureScents } from "@/components/store/home/signature-scents";
import { StorySplit } from "@/components/store/home/story-split";
import { heroSlides, homeImages } from "@/content/home";
import { listProducts } from "@/modules/storefront/queries";

export default async function HomePage() {
  const products = await listProducts();
  const images = homeImages();
  const featured = [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <>
      <IntroLoader />
      <HeroSlider slides={heroSlides()} />
      {/* Solid sections are lifted above the fixed hero photographs (z-10 each, no shared stacking
          context) so see-through ones can blur and reveal them again. */}
      <div>
        <StorySplit image={images.soho} />
        <DestinationsBand />
        <SignatureScents products={featured} />
        <Experience image={images.bag} />
      </div>
      <ParallaxFallback />
    </>
  );
}
