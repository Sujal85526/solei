import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Two-column homepage band: a media panel and a copy panel. `tone` picks the theme (dark store or
 * blush); `inset` frames the media inside the band instead of bleeding to the edge.
 */
export function MediaSplit({
  media,
  children,
  labelledBy,
  tone = "dark",
  mediaSide = "start",
  inset = false,
  id,
}: {
  media: ReactNode;
  children: ReactNode;
  labelledBy: string;
  tone?: "dark" | "blush";
  mediaSide?: "start" | "end";
  inset?: boolean;
  id?: string;
}) {
  const mediaPanel = (
    <div
      className={cn(
        "bg-noir relative overflow-hidden",
        inset
          ? "aspect-[4/5] sm:aspect-square lg:col-span-6"
          : "aspect-[4/5] sm:aspect-[16/11] lg:col-span-7 lg:aspect-auto lg:min-h-[42rem]",
        mediaSide === "end" && "lg:order-last",
      )}
    >
      {media}
    </div>
  );
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("relative z-10", tone === "blush" ? "on-blush" : "bg-noir")}
    >
      <div
        className={cn(
          "grid items-center lg:grid-cols-12",
          inset && "mx-auto max-w-[96rem] gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:gap-20 lg:px-14",
        )}
      >
        {mediaPanel}
        <div
          className={cn(
            "flex",
            inset
              ? "lg:col-span-5 lg:col-start-8"
              : "px-6 py-20 sm:px-14 lg:col-span-5 lg:px-20 lg:py-28",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
