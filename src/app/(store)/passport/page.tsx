import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowDown, ArrowRight, Gift, Plus, ShoppingBag, Ticket } from "lucide-react";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { PassportSignInButton } from "@/components/store/passport/passport-sign-in";
import { t } from "@/content/en";
import { formatBusinessDate } from "@/lib/dates";
import { waNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { progress } from "@/modules/loyalty/engine";
import { currentCardStickers } from "@/modules/loyalty/format";
import { getMyPassport, getPublicProgramme } from "@/modules/loyalty/queries";
import { getContactDetails } from "@/modules/settings/queries";

export const metadata: Metadata = {
  title: "Solei Passport",
  description: t.passport.lede,
};

const p = t.passport;
const STEP_ICONS = [ShoppingBag, Ticket, Gift];
/** Hero photo (client studio shot) and its framing. */
const HERO = { src: "/images/passport/passport-hero-wide.jpg", position: "62% 50%" };

/**
 * Solei Passport: light hero, three steps on blush, the 12-sticker tracker on burgundy (live once
 * signed in — website orders stamp automatically; WhatsApp and event purchases are added by staff
 * in Admin → Loyalty), then FAQs. Store header and footer stay as on every page.
 */
export default function PassportPage() {
  return (
    <div data-solid-header className="flex flex-col">
      <Hero />
      <Steps />
      <section
        id="your-passport"
        aria-labelledby="tracker-title"
        className="bg-burgundy-deep relative isolate scroll-mt-16 overflow-hidden"
      >
        <Suspense fallback={<div className="min-h-[24rem]" />}>
          <Tracker />
        </Suspense>
      </section>
      <Faq />
    </div>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="passport-title"
      className="bg-cream relative isolate flex min-h-[46rem] items-start overflow-hidden lg:min-h-[80svh] lg:items-center"
    >
      {/*
       * Full-width photo whose own pixels fade out towards the copy (a mask, not an overlay), so
       * the cream shows through softly with no panel edge. Slow zoom like the other heroes.
       */}
      <div aria-hidden className="passport-hero-photo absolute inset-0 -z-10">
        <Image
          src={HERO.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="passport-hero-zoom object-cover"
          style={{ objectPosition: HERO.position }}
        />
      </div>
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-14 pb-20 sm:px-10 lg:px-14 lg:py-20">
        <div className="max-w-xl">
          <Reveal as="p" className="eyebrow text-burgundy/70">
            {p.eyebrow}
          </Reveal>
          <h1
            id="passport-title"
            className="text-burgundy mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl"
          >
            {p.title}
            <br />
            {p.titleEnd}
          </h1>
          <Reveal delay={250}>
            <p className="text-ink/80 mt-6 max-w-md text-[0.95rem] leading-relaxed">{p.lede}</p>
            <div className="mt-9 flex flex-col items-start gap-5">
              <Link
                href="#your-passport"
                className="bg-burgundy text-cream hover:bg-burgundy/90 inline-flex h-12 items-center gap-3 px-7 text-[0.7rem] tracking-[0.22em] uppercase transition-colors"
              >
                {p.discover} <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
              </Link>
              <Link
                href="#how"
                className="text-burgundy border-burgundy/40 hover:border-burgundy inline-flex items-center gap-2 border-b pb-0.5 text-sm transition-colors"
              >
                {p.howLink} <ArrowDown className="size-3.5" strokeWidth={1.5} />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="on-blush relative isolate scroll-mt-16 overflow-hidden"
    >
      <div className="mx-auto grid max-w-[96rem] gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-14">
        <div className="lg:col-span-3">
          <h2
            id="how-title"
            className="text-4xl leading-tight sm:text-5xl lg:text-4xl xl:text-[2.75rem]"
          >
            {p.stepsTitle}
            <br />
            {p.stepsTitleEnd}
          </h2>
          <span aria-hidden className="bg-burgundy/40 mt-6 block h-px w-12" />
        </div>
        <ol className="divide-burgundy/15 grid gap-8 sm:grid-cols-3 sm:gap-0 sm:divide-x lg:col-span-9 xl:col-span-6 rtl:divide-x-reverse">
          {p.steps.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <Reveal
                as="li"
                key={s.title}
                delay={i * 120}
                className="flex flex-col gap-3 sm:px-6 sm:first:ps-0"
              >
                <span className="flex items-center gap-4">
                  <span className="font-display numeric text-burgundy text-4xl italic">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="border-burgundy/40 text-burgundy flex size-12 items-center justify-center rounded-full border">
                    <Icon className="size-5" strokeWidth={1.25} aria-hidden />
                  </span>
                </span>
                <h3 className="text-2xl">{s.title}</h3>
                <p className="text-foreground/75 max-w-[16rem] text-sm leading-relaxed">{s.body}</p>
              </Reveal>
            );
          })}
        </ol>
        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-sm shadow-[0_24px_48px_-24px_rgb(70_3_40/0.45)] xl:col-span-3 xl:block">
          <CinematicImage
            src="/images/passport/passport-hero.jpg"
            alt="The Solei passport with Verona and Capri destination cards and a Solei perfume"
            sizes="25vw"
            drift="3%"
          />
        </div>
      </div>
    </section>
  );
}

async function Tracker() {
  await connection();
  const [programme, me, contact] = await Promise.all([
    getPublicProgramme(),
    getMyPassport(),
    getContactDetails(),
  ]);
  const total = programme.rule?.stampsForReward ?? 12;
  const card = me.status === "ok" ? me.card : null;
  const prog = progress(card?.balance ?? 0, total);
  const stickers = card ? currentCardStickers(card.ledger, card.balance) : [];
  const available = card?.rewards.filter((r) => r.status === "available") ?? [];
  const redeemed = card?.rewards.filter((r) => r.status === "redeemed").slice(0, 3) ?? [];
  const whatsapp = contact.whatsapp ? `https://wa.me/${waNumber(contact.whatsapp)}` : null;

  return (
    <div className="mx-auto grid max-w-[96rem] items-center gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-12 lg:px-14">
      <div className="relative hidden aspect-[4/5] -rotate-6 overflow-hidden rounded-sm shadow-2xl shadow-black/50 lg:col-span-3 lg:block">
        <Image
          src="/images/passport/passport-cards.jpg"
          alt=""
          fill
          sizes="25vw"
          className="object-cover"
        />
      </div>

      <div className="border-pink/30 text-pearl flex flex-col gap-6 border p-6 sm:p-8 lg:col-span-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2
            id="tracker-title"
            className="text-pearl/80 font-sans text-[0.7rem] tracking-[0.3em] uppercase"
          >
            {p.trackerTitle}
          </h2>
          <p className="numeric text-pearl text-sm" data-testid="passport-progress">
            <span className="font-display text-xl">
              {prog.collected} / {prog.total}
            </span>{" "}
            <span className="text-pearl/60 text-[0.65rem] tracking-[0.2em] uppercase">
              {p.stickers}
            </span>
          </p>
        </div>

        <ol
          aria-label={`${prog.collected} of ${prog.total} stickers collected`}
          className="grid grid-cols-6 gap-2 sm:grid-cols-12 sm:gap-1.5"
        >
          {Array.from({ length: total }, (_, i) => {
            const filled = i < stickers.length;
            return (
              <li key={i} className="flex justify-center">
                <span
                  title={filled ? (stickers[i] ?? "Solei") : undefined}
                  className={cn(
                    "numeric flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-[0.6rem]",
                    filled
                      ? "bg-pink text-burgundy font-medium"
                      : "border-pink/40 text-pearl/60 border border-dashed",
                  )}
                >
                  {filled ? (stickers[i] ?? "Solei").slice(0, 3).toUpperCase() : i + 1}
                </span>
              </li>
            );
          })}
        </ol>

        {me.status === "signed_out" ? (
          <p className="text-pearl/70 text-sm">{p.signedOutNote}</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            {me.status === "ok" ? (
              <p className="text-pearl/70 text-xs tracking-wide">
                {p.welcome(me.name)} ·{" "}
                {me.card.passport
                  ? `${p.number} ${me.card.passport.number} · ${formatBusinessDate(me.card.passport.issuedAt)}`
                  : p.noPassportYet}
              </p>
            ) : null}
            {available.length ? (
              <div className="bg-pink/10 border-pink/30 flex flex-col gap-2 border p-4">
                <p className="text-pink text-[0.7rem] tracking-[0.25em] uppercase">
                  {p.rewardReady}
                </p>
                {available.map((r) => (
                  <p key={r.id} className="font-display text-pearl text-xl">
                    {r.label}
                  </p>
                ))}
                <p className="text-pearl/75">{p.rewardHow}</p>
                {whatsapp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="text-pink self-start text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
                  >
                    {p.whatsappUs}
                  </a>
                ) : null}
              </div>
            ) : (
              <p className="text-pearl/75">
                {prog.collected === 0 ? p.emptyNote : p.progressNote(prog.remaining)}
              </p>
            )}
            {redeemed.map((r) => (
              <p key={r.id} className="text-pearl/55 text-xs">
                {p.redeemed(r.label, formatBusinessDate(r.redeemedAt ?? r.createdAt))}
              </p>
            ))}
            {!programme.enabled ? <p className="text-pearl/60 text-xs">{p.paused}</p> : null}
          </div>
        )}
      </div>

      <div className="flex lg:col-span-3 lg:justify-end">
        {me.status === "signed_out" ? (
          <PassportSignInButton />
        ) : (
          <Link
            href="/shop"
            className="bg-pink text-burgundy hover:bg-pink/90 inline-flex h-12 items-center gap-3 px-6 text-[0.7rem] tracking-[0.22em] uppercase transition-colors"
          >
            {p.shop} <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
          </Link>
        )}
      </div>
    </div>
  );
}

function Faq() {
  return (
    <section aria-labelledby="faq-title" className="theme-light bg-cream text-ink">
      <div className="mx-auto grid max-w-[96rem] gap-10 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-12 lg:px-14">
        <div className="lg:col-span-4">
          <p className="eyebrow text-burgundy/60">{p.faqEyebrow}</p>
          <h2 id="faq-title" className="mt-4 text-4xl leading-tight sm:text-5xl">
            {p.faqTitle}
            <br />
            {p.faqTitleEnd}
          </h2>
          <span aria-hidden className="bg-burgundy/40 mt-6 block h-px w-12" />
        </div>
        <ul className="border-burgundy/15 border-t lg:col-span-8">
          {p.faq.map((f) => (
            <li key={f.q} className="border-burgundy/15 border-b">
              <details className="group">
                <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-[0.95rem] [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <Plus
                    className="text-burgundy size-4 shrink-0 transition-transform group-open:rotate-45"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </summary>
                <p className="text-ink/75 max-w-2xl pb-5 text-sm leading-relaxed">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
