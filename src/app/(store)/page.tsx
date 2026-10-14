import { Collection } from "@/components/store/home/collection";
import { ShopByDestination } from "@/components/store/home/destinations";
import { Hero } from "@/components/store/home/hero";
import { InstagramStrip } from "@/components/store/home/instagram";
import { OptIn } from "@/components/store/home/opt-in";
import { PassportBand } from "@/components/store/home/passport";
import { PlanYourEvent } from "@/components/store/home/plan-event";
import { BrandStory } from "@/components/store/home/story";
import { getHomeContent } from "@/modules/content/queries";

export default async function HomePage() {
  const content = await getHomeContent();
  return (
    <>
      <Hero />
      <ShopByDestination destinations={content.destinations} />
      <Collection collection={content.collection} />
      <PlanYourEvent eventTypes={content.eventTypes} />
      <PassportBand passport={content.passport} destinations={content.destinations} />
      <BrandStory />
      <InstagramStrip handle={content.instagram.handle} url={content.instagram.url} />
      <OptIn />
    </>
  );
}
