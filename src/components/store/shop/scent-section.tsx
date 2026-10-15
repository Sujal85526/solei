import Image from "next/image";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { t } from "@/content/en";
import type { Accord } from "@/modules/storefront/scent";

const tierLabel = (tier: Accord["tier"]) =>
  tier === "top"
    ? t.product.notesTop
    : tier === "heart"
      ? t.product.notesHeart
      : tier === "base"
        ? t.product.notesBase
        : null;

/**
 * "The scent": a close crop of the bottle beside the mood line and its accords as round motifs.
 * Burgundy band between the purchase panel and the recommendations.
 */
export function ScentSection({
  image,
  mood,
  accords,
}: {
  image: { url: string; alt: string };
  mood: string;
  accords: Accord[];
}) {
  return (
    <section aria-labelledby="scent-title" className="bg-burgundy text-pearl grid lg:grid-cols-12">
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/9] lg:col-span-6 lg:aspect-auto lg:min-h-[34rem]">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="scale-[1.6] object-cover object-[50%_40%]"
        />
      </div>
      <div className="flex flex-col justify-center px-6 py-14 sm:px-12 lg:col-span-6 lg:px-16 lg:py-20">
        <Reveal as="p" className="eyebrow text-pink/75">
          {t.product.theScent}
        </Reveal>
        <SplitHeading
          id="scent-title"
          lines={[mood]}
          italic={[]}
          className="text-pearl mt-4 max-w-md text-3xl leading-[1.1] sm:text-4xl lg:text-5xl"
        />
        <span aria-hidden className="bg-pink/40 mt-6 block h-px w-12" />
        {accords.length ? (
          <Stagger as="ul" variant="stamp" className="mt-9 flex flex-wrap gap-6 sm:gap-10">
            {accords.map((a, i) => (
              <li
                key={a.name}
                className="flex w-24 flex-col items-center gap-3 text-center sm:w-28"
              >
                <span
                  aria-hidden
                  className="border-pink/40 relative flex size-20 items-center justify-center rounded-full border sm:size-24"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${ACCENTS[i % ACCENTS.length]}, transparent 70%), color-mix(in oklab, var(--brand-pink) 12%, transparent)`,
                  }}
                >
                  <span className="font-display text-pink text-3xl italic">{a.name.charAt(0)}</span>
                </span>
                <span className="eyebrow text-pearl text-[0.55rem] leading-relaxed sm:text-[0.6rem]">
                  {a.name}
                </span>
                {tierLabel(a.tier) ? (
                  <span className="text-pearl/60 -mt-2 text-[0.7rem] italic">
                    {tierLabel(a.tier)}
                  </span>
                ) : null}
              </li>
            ))}
          </Stagger>
        ) : null}
      </div>
    </section>
  );
}

/** Soft glows for the accord motifs: gold, blush, rose. */
const ACCENTS = ["rgb(212 175 105 / 0.55)", "rgb(247 205 208 / 0.45)", "rgb(196 98 120 / 0.55)"];
