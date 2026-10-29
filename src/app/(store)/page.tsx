import { Suspense } from "react";
import { IntroLoader } from "@/components/motion/intro-loader";
import { ParallaxFallback } from "@/components/motion/parallax-fallback";
import { DestinationsBand } from "@/components/store/home/destinations-band";
import { Experience } from "@/components/store/home/experience";
import { Hero } from "@/components/store/home/hero";
import { PlanYourEvent } from "@/components/store/home/plan-your-event";
import { PromoBanners } from "@/components/store/home/promo-banners";
import { SignatureScents } from "@/components/store/home/signature-scents";
import { StorySplit } from "@/components/store/home/story-split";
import { featuredShelf, heroContent, homeImages } from "@/content/home";
import { listProducts } from "@/modules/storefront/queries";

export default async function HomePage() {
  const products = await listProducts();
  const images = homeImages();
  const shelf = featuredShelf.flatMap(({ slug, image }) => {
    const product = products.find((p) => p.slug === slug);
    // The product's cover photo (Admin → Products) wins; the editorial shot is only a fallback.
    return product ? [{ product, image: product.images[0]?.url ?? image }] : [];
  });
  return (
    <>
      <IntroLoader />
      <Hero hero={heroContent()} />
      {/* The hero stays put; everything after it scrolls up over it. */}
      <div className="bg-background relative z-10 shadow-[0_-40px_80px_-20px_rgb(0_0_0/0.65)]">
        <Suspense fallback={null}>
          <PromoBanners />
        </Suspense>
        <StorySplit image={images.soho} />
        <DestinationsBand image={images.window} />
        <PlanYourEvent image={images.events} />
        <SignatureScents items={shelf} />
        <Experience image={images.bag} />
      </div>
      <ParallaxFallback />
    </>
  );
}
