import type { Metadata } from "next";
import { Container, OrnamentDivider, PassportStamp } from "@/components/brand";
import { DestinationPostcard } from "@/components/store/shop/destination-postcard";
import { PageIntro } from "@/components/store/shop/page-intro";
import { t } from "@/content/en";
import { listDestinations } from "@/modules/storefront/queries";

export const metadata: Metadata = {
  title: t.destinations.title,
  description: t.destinations.metaDescription,
  alternates: { canonical: "/destinations" },
};

export default async function DestinationsPage() {
  const destinations = await listDestinations();
  return (
    <>
      <PageIntro
        eyebrow={t.destinations.eyebrow}
        title={
          <>
            Eight places, <span className="italic">one journey.</span>
          </>
        }
        lede={t.destinations.lede}
      />
      <Container size="wide" className="overflow-hidden pt-6 pb-24 sm:pb-32">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16">
          {destinations.map((d, i) => (
            <li key={d.slug}>
              <DestinationPostcard destination={d} index={i} priority={i < 4} />
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-24 flex max-w-xl flex-col items-center gap-6 text-center">
          <OrnamentDivider className="w-full max-w-xs" />
          <div className="flex gap-3" aria-hidden>
            {destinations.slice(0, 3).map((d, i) => (
              <PassportStamp
                key={d.slug}
                label={d.name}
                tilt={[-8, 4, -3][i]}
                className="size-20 sm:size-24"
                compact
              />
            ))}
          </div>
          <p className="font-display text-pink text-2xl leading-snug italic sm:text-3xl">
            {t.brand.collect}
          </p>
        </div>
      </Container>
    </>
  );
}
