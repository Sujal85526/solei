import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PassportStamp } from "@/components/brand";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { AccountGate } from "@/components/store/account/account-gate";
import { CircleArrowLink } from "@/components/store/home/circle-arrow-link";
import { t } from "@/content/en";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { progress } from "@/modules/loyalty/engine";
import { currentCardStickers, destinationTally, signedStamps } from "@/modules/loyalty/format";
import { getMyPassport, getPublicProgramme } from "@/modules/loyalty/queries";
import { stampKindLabels } from "@/modules/loyalty/schema";

export const metadata: Metadata = {
  title: "Solei Passport",
  description: t.passport.lede,
};

const p = t.passport;
const stampTilts = [-8, 5, -3, 7, -6, 2, -4, 6, -2, 4, -7, 3];

/**
 * Solei Passport: hero with the real passport photo in an arch, three steps, then the visitor's
 * card — sign in / create account (same Solei account as checkout) or their stamps and rewards.
 */
export default function PassportPage() {
  return (
    <>
      <section
        aria-labelledby="passport-title"
        className="bg-noir mx-auto grid max-w-[96rem] items-center gap-12 px-6 pt-14 pb-20 sm:px-10 sm:pt-20 lg:grid-cols-12 lg:gap-20 lg:px-14 lg:pb-28"
      >
        <div className="lg:col-span-6">
          <Reveal as="p" className="eyebrow text-primary/70">
            {p.eyebrow}
          </Reveal>
          <SplitHeading
            as="h1"
            id="passport-title"
            lines={[p.title, p.titleItalic]}
            className="mt-5 text-5xl sm:text-6xl lg:text-7xl"
          />
          <Reveal delay={300}>
            <span aria-hidden className="bg-primary/40 mt-8 block h-px w-12" />
            <p className="font-display text-pearl/85 mt-8 max-w-md text-xl leading-relaxed italic">
              {p.lede}
            </p>
            <div className="mt-10">
              <CircleArrowLink href="#your-passport">{p.open}</CircleArrowLink>
            </div>
          </Reveal>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <div className="arch relative mx-auto aspect-[4/5] w-full max-w-md">
            <CinematicImage
              src="/images/events/booth-passport.jpg"
              alt="Solei passports beside Verona, Santorini and Capri perfumes at a pop-up"
              sizes="(min-width: 1024px) 36vw, 90vw"
              drift="4%"
            />
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <Steps />
      </Suspense>

      <section
        id="your-passport"
        aria-labelledby="your-passport-title"
        className="on-blush scroll-mt-16 px-6 py-20 sm:px-10 sm:py-28"
      >
        <Suspense fallback={<div className="min-h-[28rem]" />}>
          <YourPassport />
        </Suspense>
      </section>
    </>
  );
}

async function Steps() {
  const programme = await getPublicProgramme();
  const rule = programme.rule;
  if (!rule) return null;
  const steps = [
    {
      title: `${rule.stampsPerItem === 1 ? "One stamp" : `${rule.stampsPerItem} stamps`} per piece`,
      body: "Every perfume, all-over spray or dukhoon stamps its destination — online, at pop-ups and at events.",
    },
    {
      title: `${rule.stampsForReward} stamps, one gift`,
      body: `Fill a card and ${rule.rewardLabel} is yours.`,
    },
    {
      title: "Your passport",
      body: rule.issuePassportAfterPurchases
        ? `Issued after ${rule.issuePassportAfterPurchases} purchases — or ask our team for one.`
        : "Ask our team for one at any pop-up.",
    },
  ];
  return (
    <section
      aria-labelledby="passport-how"
      className="border-pink/10 mx-auto max-w-[96rem] border-t px-6 py-20 sm:px-10 sm:py-24 lg:px-14"
    >
      <h2 id="passport-how" className="sr-only">
        {p.howTitle}
      </h2>
      {!programme.enabled ? <p className="text-pearl-muted mb-10">{p.paused}</p> : null}
      <ol className="grid gap-12 sm:grid-cols-3 sm:gap-10">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 120} className="flex flex-col gap-4">
            <span className="font-display text-gold numeric text-5xl italic">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-2xl">{s.title}</h3>
            <p className="text-pearl/75 max-w-xs text-sm leading-relaxed">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

async function YourPassport() {
  await connection();
  const [programme, me] = await Promise.all([getPublicProgramme(), getMyPassport()]);

  if (me.status === "signed_out") {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm text-center lg:pt-10 lg:text-start">
          <p className="eyebrow text-primary/70">{p.number}</p>
          <h2 id="your-passport-title" className="mt-4 text-4xl sm:text-5xl">
            {p.signInTitle}
          </h2>
          <p className="mt-5 text-sm leading-relaxed">{p.signInLede}</p>
          <EmptyStamps total={programme.rule?.stampsForReward ?? 12} className="mt-10" />
        </div>
        <div className="theme-light w-full max-w-sm rounded-sm p-7 shadow-[0_24px_48px_-24px_rgb(70_3_40/0.35)] sm:p-9">
          <AccountGate />
        </div>
      </div>
    );
  }

  if (me.status === "no_customer") {
    const total = programme.rule?.stampsForReward ?? 12;
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <h2 id="your-passport-title" className="text-4xl sm:text-5xl">
          {p.emptyTitle}
        </h2>
        <p className="max-w-md text-sm leading-relaxed">{p.noStamps}</p>
        <StampCard collected={0} total={total} stickers={[]} className="max-w-xl" />
        <Link
          href="/shop"
          className="text-[0.7rem] tracking-[0.22em] uppercase underline underline-offset-4"
        >
          {p.shop}
        </Link>
      </div>
    );
  }

  const { card, name } = me;
  const total = programme.rule?.stampsForReward ?? 12;
  const rewardLabel = programme.rule?.rewardLabel ?? "your next gift";
  const prog = progress(card.balance, total);
  const stickers = currentCardStickers(card.ledger, card.balance);
  const destinations = destinationTally(card.ledger);
  const available = card.rewards.filter((r) => r.status === "available");
  const history = card.ledger.filter((e) => e.kind !== "redeemed").slice(0, 5);

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-7">
        <h2 id="your-passport-title" className="text-4xl sm:text-5xl">
          {p.welcome(name)}
        </h2>
        <p className="eyebrow text-primary/70 mt-3">
          {card.passport
            ? `${p.number} ${card.passport.number} · ${formatBusinessDate(card.passport.issuedAt)}`
            : p.noPassportYet}
        </p>
        <StampCard
          collected={prog.collected}
          total={prog.total}
          stickers={stickers}
          className="mt-8"
        />
        <p className="mt-5 text-sm">
          {p.progress(prog.collected, prog.total, prog.remaining, rewardLabel)}
        </p>
      </div>

      <div className="flex flex-col gap-10 lg:col-span-5 lg:pt-24">
        {available.length ? (
          <div className="flex flex-col gap-3">
            <h3 className="eyebrow font-sans">{p.rewardsTitle}</h3>
            {available.map((r) => (
              <div key={r.id} className="border-burgundy/25 flex flex-col gap-2 border p-5">
                <p className="eyebrow text-burgundy/80">{p.rewardReady}</p>
                <p className="font-display text-2xl">{r.label}</p>
                <p className="text-sm">{p.rewardHow}</p>
              </div>
            ))}
          </div>
        ) : null}
        {destinations.length ? (
          <div className="flex flex-col gap-3">
            <h3 className="eyebrow font-sans">{p.destinationsTitle}</h3>
            <ul className="flex flex-wrap gap-2">
              {destinations.map((d) => (
                <li
                  key={d.name}
                  className="border-burgundy/30 eyebrow flex items-center gap-2 border px-3 py-2"
                >
                  {d.name} <span className="numeric opacity-70">×{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <h3 className="eyebrow font-sans">{p.historyTitle}</h3>
          {history.length ? (
            <ul className="divide-burgundy/15 border-burgundy/15 divide-y border-y">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-display text-lg">
                      {e.destination ?? stampKindLabels[e.kind]}
                    </span>
                    <span className="text-xs opacity-70">
                      {formatBusinessDate(e.createdAt)}
                      {e.order ? ` · ${e.order.number}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn("numeric font-display text-xl", e.stamps <= 0 && "opacity-60")}
                  >
                    {signedStamps(e.stamps)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{p.noStamps}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** The stamp page of the passport: collected destination stamps, then numbered empty slots. */
function StampCard({
  collected,
  total,
  stickers,
  className,
}: {
  collected: number;
  total: number;
  stickers: (string | null)[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-cream w-full rounded-sm p-5 shadow-[0_24px_48px_-24px_rgb(70_3_40/0.35)] sm:p-8",
        className,
      )}
    >
      <div className="border-burgundy/15 flex items-baseline justify-between gap-2 border-b pb-4">
        <p className="eyebrow text-burgundy font-sans">{p.stampsTitle}</p>
        <p className="numeric font-display text-burgundy text-xl" data-testid="passport-progress">
          {collected} / {total}
        </p>
      </div>
      <ol
        aria-label={`${collected} of ${total} stamps collected`}
        className="grid grid-cols-4 gap-3 pt-6 sm:gap-5"
      >
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className="flex justify-center">
            {i < stickers.length ? (
              <PassportStamp
                label={stickers[i] ?? "Solei"}
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
      </ol>
    </div>
  );
}

/** A small row of tilted sample stamps beside the sign-in card (decorative). */
function EmptyStamps({ total, className }: { total: number; className?: string }) {
  const samples = ["Cannes", "Capri", "Soho"];
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center gap-3 lg:justify-start", className)}
    >
      {samples.map((s, i) => (
        <PassportStamp
          key={s}
          label={s}
          tilt={stampTilts[i * 3]}
          variant={i === 1 ? "filled" : "ink"}
          className="w-20"
        />
      ))}
      <span className="font-display numeric ms-2 text-2xl italic opacity-70">/ {total}</span>
    </div>
  );
}
