import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { helpCopy as c, helpTopics, type HelpTopic } from "@/content/help";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Help centre: every policy on one page — topics on the start side, the chosen one beside them
 * (`?tab=shipping|returns|passport|terms|privacy|cookies`). Old /policies/* links redirect here.
 */
export default function HelpPage({ searchParams }: PageProps<"/help">) {
  return (
    <div className="mx-auto w-full max-w-[90rem] px-6 pt-14 pb-24 sm:px-10 sm:pt-20 lg:px-14">
      <header className="border-pink/10 max-w-2xl border-b pb-10">
        <Reveal as="p" className="eyebrow text-primary/70">
          {c.eyebrow}
        </Reveal>
        <h1 className="mt-4 text-5xl sm:text-6xl">{c.title}</h1>
        <p className="text-pearl/75 mt-6 text-[0.95rem] leading-relaxed">{c.lede}</p>
      </header>
      <Suspense fallback={<div className="min-h-[50vh]" />}>
        <Topics searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Topics({ searchParams }: { searchParams: PageProps<"/help">["searchParams"] }) {
  const { tab } = await searchParams;
  const topic = helpTopics.find((t) => t.key === tab) ?? helpTopics[0];
  const row =
    "group flex items-center justify-between gap-4 border-b border-pink/10 py-4 text-sm transition-colors";
  return (
    <div className="grid gap-12 pt-12 lg:grid-cols-12 lg:gap-16">
      <nav aria-label={c.eyebrow} className="lg:col-span-4 xl:col-span-3">
        <ul className="border-pink/10 border-t lg:sticky lg:top-24">
          <li>
            <Link href="/contact" className={cn(row, "text-pearl/75 hover:text-pink")}>
              {c.contact}
              <ArrowUpRight className="size-4 opacity-60" strokeWidth={1.25} />
            </Link>
          </li>
          {helpTopics.map((t) => {
            const active = t.key === topic.key;
            return (
              <li key={t.key}>
                <Link
                  href={`/help?tab=${t.key}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(row, active ? "text-pink" : "text-pearl/75 hover:text-pink")}
                >
                  {t.title}
                  <ArrowRight
                    className={cn(
                      "size-4 transition-transform rtl:rotate-180",
                      active ? "rotate-90 rtl:rotate-90" : "opacity-60",
                    )}
                    strokeWidth={1.25}
                  />
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/track" className={cn(row, "text-pearl/75 hover:text-pink")}>
              {c.track}
              <ArrowUpRight className="size-4 opacity-60" strokeWidth={1.25} />
            </Link>
          </li>
        </ul>
      </nav>
      <TopicBody topic={topic} />
    </div>
  );
}

function TopicBody({ topic }: { topic: HelpTopic }) {
  return (
    <article aria-labelledby="topic-title" className="max-w-2xl lg:col-span-8 xl:col-span-7">
      <h2 id="topic-title" className="text-4xl sm:text-5xl">
        {topic.title}
      </h2>
      {topic.updated ? (
        <p className="text-pearl-muted mt-3 text-xs">
          {c.updated}: <Text value={topic.updated} />
        </p>
      ) : null}
      {topic.intro ? (
        <p className="text-pearl/85 mt-6 text-[0.95rem] leading-relaxed">
          <Text value={topic.intro} />
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-8">
        {topic.blocks.map((b, i) => (
          <section key={b.heading ?? i} className="flex flex-col gap-3">
            {b.heading ? (
              <h3 className="border-pink/10 text-pink border-b pb-3 font-sans text-sm font-medium tracking-wide">
                {b.heading}
              </h3>
            ) : null}
            {b.paragraphs?.map((p) => (
              <p key={p.slice(0, 24)} className="text-pearl/75 text-sm leading-relaxed">
                <Text value={p} />
              </p>
            ))}
            {b.list ? (
              <ol className="text-pearl/75 marker:text-pink/60 flex list-decimal flex-col gap-3 ps-5 text-sm leading-relaxed">
                {b.list.map((item) => (
                  <li key={item.slice(0, 24)}>
                    <Text value={item} />
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

/** Policy text; `[…]` items the client still has to confirm show as a small marker. */
function Text({ value }: { value: string }) {
  return value.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span
        key={i}
        title={c.toConfirm}
        className="border-pink/30 bg-pink/10 text-pink mx-0.5 inline rounded-sm border border-dashed px-1.5 py-px text-[0.7rem] tracking-wide"
      >
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
