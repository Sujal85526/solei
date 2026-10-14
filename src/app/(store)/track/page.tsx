import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/brand";
import { TrackForm } from "@/components/store/checkout/track-form";
import { PageIntro } from "@/components/store/shop/page-intro";
import { t } from "@/content/en";

export const metadata: Metadata = { title: t.track.title, robots: { index: false } };

export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <>
      <PageIntro
        eyebrow="Your order"
        title={t.track.title}
        lede={t.track.lede}
        className="pb-8 sm:pb-12"
      />
      <Container className="pb-24 sm:pb-32">
        <Suspense>
          <TrackWithParams searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

async function TrackWithParams({
  searchParams,
}: {
  searchParams: PageProps<"/track">["searchParams"];
}) {
  const sp = await searchParams;
  return <TrackForm defaultNumber={typeof sp.number === "string" ? sp.number : undefined} />;
}
