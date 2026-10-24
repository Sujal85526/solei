import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { GiftCardForm } from "@/components/store/gift-cards/gift-card-form";
import { giftCardsCopy as c } from "@/content/gift-cards";
import { getGiftCardSettings } from "@/modules/gift-cards/queries";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Gift cards: the brand line, then the purchase form beside a live preview of the card. Amounts,
 * expiry and where it can be spent come from Admin → Gift cards → Settings.
 */
export default async function GiftCardsPage() {
  const settings = await getGiftCardSettings();
  const intro = (
    <>
      <Reveal as="p" className="eyebrow text-primary/70">
        {c.eyebrow}
      </Reveal>
      <SplitHeading
        as="h1"
        id="gift-title"
        lines={[...c.title]}
        className="mt-5 text-5xl sm:text-6xl lg:text-7xl"
      />
      <Reveal delay={250}>
        <span aria-hidden className="bg-primary/40 mt-8 block h-px w-12" />
        <p className="text-foreground/80 mt-8 max-w-md text-[0.95rem] leading-relaxed">{c.lede}</p>
      </Reveal>
    </>
  );
  return (
    <section aria-labelledby="gift-title" data-solid-header className="on-blush">
      <div className="mx-auto max-w-[96rem] px-6 pt-14 pb-24 sm:px-10 sm:pt-20 lg:px-14 lg:pb-32">
        {settings.enabled ? (
          <GiftCardForm
            intro={intro}
            amountsFils={settings.amountsFils}
            atPos={settings.atPos}
            expiryMonths={settings.expiryMonths}
          />
        ) : (
          <>
            {intro}
            <p className="font-display text-burgundy mt-12 text-2xl">{c.unavailable}</p>
          </>
        )}
      </div>
    </section>
  );
}
