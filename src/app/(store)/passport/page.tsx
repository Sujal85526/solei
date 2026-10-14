import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container, Eyebrow, OrnamentDivider, PassportStamp } from "@/components/brand";
import { PassportSignIn } from "@/components/store/passport/passport-sign-in";
import { PageIntro } from "@/components/store/shop/page-intro";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { progress } from "@/modules/loyalty/engine";
import { currentCardStickers, destinationTally, signedStamps } from "@/modules/loyalty/format";
import { signOutPassportAction } from "@/modules/loyalty/passport-actions";
import { getMyPassport, getPublicProgramme, type PublicProgramme } from "@/modules/loyalty/queries";
import { stampKindLabels } from "@/modules/loyalty/schema";

export const metadata: Metadata = {
  title: "Solei Passport",
  description: t.passport.lede,
};

const stampTilts = [-8, 5, -3, 7, -6, 2, -4, 6, -2, 4, -7, 3];

export default function PassportPage({ searchParams }: PageProps<"/passport">) {
  return (
    <>
      <PageIntro
        eyebrow={t.passport.eyebrow}
        title={
          <>
            {t.passport.title} <span className="italic">{t.passport.titleItalic}</span>
          </>
        }
        lede={t.passport.lede}
        className="pb-8 sm:pb-12"
      />
      <Suspense
        fallback={
          <Container className="text-pearl-muted pb-24 text-sm">Opening your passport…</Container>
        }
      >
        <PassportView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PassportView({
  searchParams,
}: {
  searchParams: PageProps<"/passport">["searchParams"];
}) {
  await connection();
  const [sp, programme, me] = await Promise.all([
    searchParams,
    getPublicProgramme(),
    getMyPassport(),
  ]);

  if (me.status === "ok") {
    return <SignedIn name={me.name} card={me.card} programme={programme} />;
  }

  return (
    <Container size="wide" className="flex flex-col gap-16 pb-24 sm:pb-32">
      <HowItWorks programme={programme} />
      <section
        aria-labelledby="passport-sign-in"
        className="border-pink/20 bg-wine/60 flex max-w-2xl flex-col gap-5 border p-6 sm:p-10"
      >
        <Eyebrow>{t.passport.number}</Eyebrow>
        {me.status === "no_customer" ? (
          <>
            <h2 id="passport-sign-in" className="text-3xl sm:text-4xl">
              {t.passport.notFoundTitle}
            </h2>
            <p className="text-pearl/85">{t.passport.notFound(me.email)}</p>
            <form action={signOutPassportAction}>
              <Button type="submit" variant="outline">
                {t.passport.signOut}
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 id="passport-sign-in" className="text-3xl sm:text-4xl">
              {t.passport.signInTitle}
            </h2>
            <p className="text-pearl/85">{t.passport.signInLede}</p>
            <PassportSignIn linkError={sp.error === "link"} />
          </>
        )}
      </section>
    </Container>
  );
}

function HowItWorks({ programme }: { programme: PublicProgramme }) {
  const rule = programme.rule;
  if (!rule) return null;
  const steps = [
    {
      title: `${rule.stampsPerItem === 1 ? "One stamp" : `${rule.stampsPerItem} stamps`} per piece`,
      body: "Each perfume, all-over spray or dukhoon you buy stamps its destination in your passport — online, at pop-ups and at events.",
    },
    {
      title: `${rule.stampsForReward} stamps, one gift`,
      body: `Fill a card and ${rule.rewardLabel} is yours.`,
    },
    {
      title: "Your passport",
      body: rule.issuePassportAfterPurchases
        ? `It's issued after ${rule.issuePassportAfterPurchases} purchases — or just ask our team for one.`
        : "Ask our team for one at any pop-up.",
    },
  ];
  return (
    <section aria-labelledby="passport-how" className="flex flex-col gap-8">
      <h2 id="passport-how" className="text-3xl sm:text-4xl">
        {t.passport.howTitle}
      </h2>
      {!programme.enabled ? <p className="text-pearl-muted">{t.passport.paused}</p> : null}
      <ol className="grid gap-8 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="border-pink/20 flex flex-col gap-3 border-t pt-6">
            <span className="eyebrow text-gold numeric">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-2xl">{s.title}</h3>
            <p className="text-pearl/80 text-sm leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SignedIn({
  name,
  card,
  programme,
}: {
  name: string;
  card: Extract<Awaited<ReturnType<typeof getMyPassport>>, { status: "ok" }>["card"];
  programme: PublicProgramme;
}) {
  const total = programme.rule?.stampsForReward ?? 12;
  const rewardLabel = programme.rule?.rewardLabel ?? "your next gift";
  const p = progress(card.balance, total);
  const stickers = currentCardStickers(card.ledger, card.balance);
  const destinations = destinationTally(card.ledger);
  const available = card.rewards.filter((r) => r.status === "available");
  const history = card.ledger.filter((e) => e.kind !== "redeemed").slice(0, 8);

  return (
    <>
      <Container size="wide" className="flex flex-col gap-6 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-display text-pink text-3xl sm:text-4xl">
              {t.passport.welcome(name)}
            </p>
            <p className="eyebrow text-pearl-muted">
              {card.passport
                ? `${t.passport.number} ${card.passport.number} · ${formatBusinessDate(card.passport.issuedAt)}`
                : t.passport.noPassportYet}
            </p>
          </div>
          <form action={signOutPassportAction}>
            <Button type="submit" variant="outline" size="sm">
              {t.passport.signOut}
            </Button>
          </form>
        </div>
        {!programme.enabled ? <p className="text-pearl-muted">{t.passport.paused}</p> : null}
      </Container>

      <section aria-labelledby="passport-stamps" className="on-blush py-16 sm:py-24">
        <Container size="wide" className="grid items-start gap-10 lg:grid-cols-12">
          <div className="bg-cream rounded-sm p-5 shadow-[0_24px_48px_-24px_rgb(70_3_40/0.35)] sm:p-8 lg:col-span-7">
            <div className="border-burgundy/15 flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
              <h2 id="passport-stamps" className="eyebrow text-burgundy font-sans">
                {t.passport.stampsTitle}
              </h2>
              <p
                className="numeric font-display text-burgundy text-xl"
                data-testid="passport-progress"
              >
                {p.collected} / {p.total}
              </p>
            </div>
            <ol
              aria-label={`${p.collected} of ${p.total} stamps collected`}
              className="grid grid-cols-4 gap-3 pt-6 sm:gap-5"
            >
              {Array.from({ length: p.total }, (_, i) => (
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
            <p className="text-burgundy pt-6 text-sm">
              {t.passport.progress(p.collected, p.total, p.remaining, rewardLabel)}
            </p>
          </div>

          <div className="flex flex-col gap-10 lg:col-span-5">
            <div className="flex flex-col gap-4">
              <h2 className="text-3xl sm:text-4xl">{t.passport.rewardsTitle}</h2>
              {available.length ? (
                <ul className="flex flex-col gap-3">
                  {available.map((r) => (
                    <li key={r.id} className="border-burgundy/25 flex flex-col gap-2 border p-5">
                      <Eyebrow className="text-burgundy/80">{t.passport.rewardReady}</Eyebrow>
                      <p className="font-display text-2xl">{r.label}</p>
                      <p className="text-sm">{t.passport.rewardHow}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">
                  {t.passport.progress(p.collected, p.total, p.remaining, rewardLabel)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl sm:text-3xl">{t.passport.destinationsTitle}</h2>
              {destinations.length ? (
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
              ) : (
                <p className="text-sm">{t.passport.noStamps}</p>
              )}
            </div>
          </div>
        </Container>
      </section>

      <Container size="wide" className="flex flex-col gap-6 py-16 sm:py-24">
        <h2 className="text-3xl sm:text-4xl">{t.passport.historyTitle}</h2>
        {history.length ? (
          <ul className="divide-pink/15 border-pink/15 divide-y border-y">
            {history.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-display text-xl">
                    {e.destination ?? stampKindLabels[e.kind]}
                  </span>
                  <span className="text-pearl-muted text-xs">
                    {formatBusinessDate(e.createdAt)}
                    {e.order ? ` · ${e.order.number}` : ""}
                    {e.kind !== "earned" ? ` · ${stampKindLabels[e.kind]}` : ""}
                  </span>
                </div>
                <span
                  className={cn(
                    "numeric font-display text-2xl",
                    e.stamps > 0 ? "text-pink" : "text-pearl-muted",
                  )}
                >
                  {signedStamps(e.stamps)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pearl-muted">{t.passport.noStamps}</p>
        )}
        <OrnamentDivider className="text-gold/60 my-6 w-40 self-center" />
        <Link href="/shop" className={cn(buttonVariants({ size: "cta" }), "self-center")}>
          {t.passport.shop}
        </Link>
      </Container>
    </>
  );
}
