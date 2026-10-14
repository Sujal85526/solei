import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { cn } from "@/lib/utils";

/**
 * Eyebrow, animated display heading, hairline, body and an optional action — the copy block every
 * homepage section uses. Colours come from the section theme (`.theme-store` / `.on-blush`).
 */
export function SectionCopy({
  id,
  eyebrow,
  title,
  children,
  action,
  className,
}: {
  id: string;
  eyebrow: string;
  /** Heading lines; the last one is set in italic. */
  title: string[];
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-md", className)}>
      <Reveal as="p" className="eyebrow text-primary/70">
        {eyebrow}
      </Reveal>
      <SplitHeading
        id={id}
        lines={title}
        className="mt-4 text-4xl sm:mt-5 sm:text-5xl lg:text-6xl"
      />
      <Reveal delay={250}>
        <span aria-hidden className="bg-primary/40 mt-6 block h-px w-12 sm:mt-8" />
        {children ? (
          <div className="text-foreground/80 mt-6 text-sm leading-relaxed sm:mt-8 sm:text-[0.95rem]">
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-8 sm:mt-10">{action}</div> : null}
      </Reveal>
    </div>
  );
}
