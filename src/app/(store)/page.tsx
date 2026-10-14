import { IntroLoader } from "@/components/motion/intro-loader";
import { ParallaxFallback } from "@/components/motion/parallax-fallback";
import { DestinationsBand } from "@/components/store/home/destinations-band";
import { Experience } from "@/components/store/home/experience";
import { HeroSlider } from "@/components/store/home/hero-slider";
import { PassportBand } from "@/components/store/home/passport";
import { PlanYourEvent } from "@/components/store/home/plan-event";
import { SignatureScents } from "@/components/store/home/signature-scents";
import { StorySplit } from "@/components/store/home/story-split";
import { heroSlides, homeImages } from "@/content/home";
import { getHomeContent } from "@/modules/content/queries";
import { listProducts } from "@/modules/storefront/queries";

export default async function HomePage() {
  const [content, products] = await Promise.all([getHomeContent(), listProducts()]);
  const images = homeImages();
  const featured = [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <>
      <IntroLoader />
      <HeroSlider slides={heroSlides()} />
      <SignatureScents products={featured} />
      <StorySplit image={images.soho} />
      <DestinationsBand image={images.window} destinations={content.destinations} />
      <PlanYourEvent eventTypes={content.eventTypes} image={images.booth} />
      <PassportBand passport={content.passport} destinations={content.destinations} />
      <Experience />
      <ParallaxFallback />
    </>
  );
}
