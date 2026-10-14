import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./motifs";

/** Page-width container with generous editorial gutters. */
export function Container({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "narrow" | "default" | "wide";
}) {
  const max = { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-[90rem]" }[size];
  return (
    <div className={cn("mx-auto w-full px-5 sm:px-8 lg:px-12", max, className)}>{children}</div>
  );
}

export function Section({
  children,
  className,
  tone = "cream",
  id,
  "aria-labelledby": labelledBy,
}: {
  children: ReactNode;
  className?: string;
  tone?: "cream" | "sand" | "burgundy" | "pink";
  id?: string;
  "aria-labelledby"?: string;
}) {
  const bg = {
    cream: "bg-cream text-ink",
    sand: "bg-sand text-ink",
    burgundy: "bg-burgundy text-cream [&_h2]:text-pink [&_h3]:text-pink",
    pink: "bg-pink text-burgundy",
  }[tone];
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-20 sm:py-28", bg, className)}>
      {children}
    </section>
  );
}

/** Eyebrow + display heading + optional italic lede, as in the company profile. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  align = "start",
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <Eyebrow lines={align === "center"}>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
        {title}
      </h2>
      {lede ? (
        <p className="font-display max-w-xl text-lg leading-relaxed italic opacity-90 sm:text-xl">
          {lede}
        </p>
      ) : null}
    </div>
  );
}
