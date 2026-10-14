import Link from "next/link";
import { Container, Eyebrow, PassportStamp, Section } from "@/components/brand";
import { Parallax } from "@/components/motion/parallax";
import { Stagger } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";
import { buttonVariants } from "@/components/ui/button";
import type { HomeContent, HomeDestination } from "@/modules/content/queries";

const stampTilts = [-8, 5, -3, 7, -6, 2, -4, 6, -2, 4, -7, 3];

export function PassportBand({
  passport,
  destinations,
}: {
  passport: HomeContent["passport"];
  destinations: HomeDestination[];
}) {
  if (!passport.enabled) return null;
  const total = passport.stampsForReward;
  // Illustrative progress: two thirds collected.
  const collected = Math.max(1, Math.round((total * 2) / 3));
  const stamps = Array.from({ length: total }, (_, i) => destinations[i % destinations.length]);

  return (
    <Section tone="pink" aria-labelledby="passport-title" className="on-blush overflow-hidden">
      <Container size="wide" className="grid items-center gap-14 lg:grid-cols-12">
        <Stagger className="flex flex-col gap-6 lg:col-span-5">
          <Eyebrow className="text-burgundy/80">The Solei Passport</Eyebrow>
          <h2 id="passport-title" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Collect the destinations. <span className="italic">Keep the memory.</span>
          </h2>
          <p className="max-w-md text-base leading-relaxed">
            Every Solei piece you buy earns a destination stamp — online, at our pop-ups and events.
            {passport.issueAfterPurchases
              ? ` Your passport arrives after ${passport.issueAfterPurchases} purchases, or simply ask for one.`
              : " Simply ask for your passport at any of our pop-ups."}
          </p>
          <p className="font-display text-2xl leading-snug sm:text-3xl">
            <span className="numeric">{total}</span> stamps = {passport.rewardLabel}.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/passport" className={buttonVariants({ size: "cta" })}>
              Discover the Passport
            </Link>
          </div>
        </Stagger>

        <div className="lg:col-span-6 lg:col-start-7">
          <Parallax
            from="24px"
            to="-24px"
            className="bg-cream relative rounded-sm p-5 shadow-[0_24px_48px_-24px_rgb(70_3_40/0.35)] sm:p-8"
          >
            <div className="border-burgundy/15 flex items-baseline justify-between border-b pb-4">
              <p className="eyebrow text-burgundy">Passport · Stamps</p>
              <p className="numeric font-display text-burgundy text-xl">
                {collected} / {total}
              </p>
            </div>
            {/* Stamps press in one after another as the passport scrolls into view. */}
            <Stagger
              as="ol"
              variant="stamp"
              step={70}
              delay={150}
              aria-label={`${collected} of ${total} stamps collected (example)`}
              className="grid grid-cols-4 gap-3 pt-6 sm:gap-5"
            >
              {stamps.map((d, i) => (
                <li key={i} className="flex justify-center">
                  {i < collected ? (
                    <PassportStamp
                      label={d.name}
                      tilt={stampTilts[i % stampTilts.length]}
                      variant={i % 3 === 1 ? "filled" : "ink"}
                      compact
                      className="w-full max-w-24"
                    />
                  ) : (
                    <PassportStamp
                      label={String(i + 1).padStart(2, "0")}
                      tilt={0}
                      variant="empty"
                      compact
                      className="w-full max-w-24"
                    />
                  )}
                </li>
              ))}
            </Stagger>
          </Parallax>
          {/* The loose photo sits at a nearer depth than the passport, so it travels further. */}
          <Parallax
            from="70px"
            to="-50px"
            className="bg-cream relative ms-auto me-4 -mt-10 hidden w-56 rotate-3 p-2 shadow-lg sm:block"
          >
            <ShimmerImage
              src="/images/events/booth-passport.jpg"
              alt="Solei passports beside perfume bottles at a pop-up"
              width={968}
              height={726}
              sizes="224px"
              className="aspect-[4/3] object-cover"
            />
          </Parallax>
        </div>
      </Container>
    </Section>
  );
}
