import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { helpCopy as c } from "@/content/help";
import { cn } from "@/lib/utils";
import { parseHelpBody, splitMarkers } from "@/modules/help/format";
import { getHelpTopics } from "@/modules/help/queries";
import type { HelpTopic } from "@/modules/help/schema";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Help centre on baby pink: every policy on one page — topics beside a cream reading card
 * (`?tab=<slug>`). Wording lives in the database (Admin → Settings → Help & policies).
 * Old /policies/* links redirect here.
 */
export default function HelpPage({ searchParams }: PageProps<"/help">) {
  return (
    <div data-solid-header className="on-blush flex-1">
      <div className="mx-auto w-full max-w-6xl px-6 pt-14 pb-24 sm:px-10 sm:pt-20">
        <header className="max-w-xl">
          <Reveal as="p" className="eyebrow text-burgundy/60">
            {c.eyebrow}
          </Reveal>
          <h1 className="mt-4 text-5xl sm:text-6xl">
            {c.titleStart} <span className="italic">{c.titleItalic}</span>
          </h1>
          <p className="text-foreground/75 mt-5 text-[0.95rem] leading-relaxed">{c.lede}</p>
        </header>
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <Topics searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Topics({ searchParams }: { searchParams: PageProps<"/help">["searchParams"] }) {
  const [{ tab }, topics] = await Promise.all([searchParams, getHelpTopics()]);
  const topic = topics.find((t) => t.slug === tab) ?? topics[0];
  if (!topic) return null;
  const extra = "text-burgundy/60 hover:text-burgundy";
  return (
    <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12 lg:gap-14">
      <nav aria-label={c.eyebrow} className="lg:col-span-4">
        {/* Phones: a scrollable row of chips; wide screens: a quiet list. */}
        <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0">
          {topics.map((t) => {
            const active = t.slug === topic.slug;
            return (
              <li key={t.id} className="shrink-0">
                <Link
                  href={`/help?tab=${t.slug}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                    "lg:rounded-none lg:border-0 lg:border-b lg:px-0 lg:py-3.5",
                    active
                      ? "border-burgundy bg-burgundy text-pink lg:border-burgundy/15 lg:text-burgundy lg:bg-transparent"
                      : "border-burgundy/20 text-burgundy/70 hover:text-burgundy lg:border-burgundy/15",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "bg-burgundy hidden size-1.5 rounded-full transition-opacity lg:block",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {t.title}
                </Link>
              </li>
            );
          })}
          <li className="hidden lg:block">
            <Link
              href="/contact"
              className={cn("mt-6 flex items-center gap-2 text-sm transition-colors", extra)}
            >
              {c.contact} <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          </li>
          <li className="hidden lg:block">
            <Link
              href="/track"
              className={cn("mt-3 flex items-center gap-2 text-sm transition-colors", extra)}
            >
              {c.track} <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          </li>
        </ul>
      </nav>
      <TopicCard topic={topic} />
    </div>
  );
}

function TopicCard({ topic }: { topic: HelpTopic }) {
  const blocks = parseHelpBody(topic.body);
  return (
    <article
      aria-labelledby="topic-title"
      className="bg-cream text-ink rounded-sm px-6 py-9 shadow-[0_30px_60px_-30px_rgb(70_3_40/0.35)] sm:px-12 sm:py-12 lg:col-span-8"
    >
      <h2 id="topic-title" className="text-4xl sm:text-5xl">
        {topic.title}
      </h2>
      {topic.updatedLabel ? (
        <p className="text-ink-muted mt-3 text-xs">
          {c.updated}: <Text value={topic.updatedLabel} />
        </p>
      ) : null}
      <span aria-hidden className="bg-burgundy/30 mt-7 block h-px w-12" />
      <div className="mt-7 flex flex-col gap-4">
        {blocks.map((b, i) =>
          b.type === "heading" ? (
            <h3
              key={i}
              className="font-display text-burgundy mt-5 text-2xl first:mt-0 sm:text-[1.65rem]"
            >
              {b.text}
            </h3>
          ) : b.type === "list" ? (
            <ol
              key={i}
              className="marker:text-burgundy/60 text-ink/80 flex list-decimal flex-col gap-3 ps-5 text-[0.92rem] leading-relaxed"
            >
              {b.items.map((item, j) => (
                <li key={j} className="ps-1">
                  <Text value={item} />
                </li>
              ))}
            </ol>
          ) : (
            <p key={i} className="text-ink/80 text-[0.92rem] leading-relaxed">
              <Text value={b.text} />
            </p>
          ),
        )}
      </div>
    </article>
  );
}

/** Policy text; `[…]` details the client still has to confirm show as a dashed marker. */
function Text({ value }: { value: string }) {
  return splitMarkers(value).map((part, i) =>
    part.marker ? (
      <span
        key={i}
        title={c.toConfirm}
        className="border-burgundy/35 bg-pink/40 text-burgundy mx-0.5 inline rounded-sm border border-dashed px-1.5 py-px text-[0.7rem] tracking-wide"
      >
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
