import { IntroLoader } from "@/components/motion/intro-loader";
import { ParallaxFallback } from "@/components/motion/parallax-fallback";
import { DestinationsBand } from "@/components/store/home/destinations-band";
import { Experience } from "@/components/store/home/experience";
import { Hero } from "@/components/store/home/hero";
import { SignatureScents } from "@/components/store/home/signature-scents";
import { StorySplit } from "@/components/store/home/story-split";
import { heroContent, homeImages } from "@/content/home";
import { listProducts } from "@/modules/storefront/queries";

export default async function HomePage() {
  const products = await listProducts();
  const images = homeImages();
  const featured = [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <>
      <IntroLoader />
      <Hero hero={heroContent()} />
      {/* The hero stays put; everything after it scrolls up over it. */}
      <div className="bg-background relative z-10 shadow-[0_-40px_80px_-20px_rgb(0_0_0/0.65)]">
        <StorySplit image={images.soho} />
        <DestinationsBand image={images.window} />
        <SignatureScents products={featured} />
        <Experience image={images.bag} />
      </div>
      <ParallaxFallback />
    </>
  );
}
