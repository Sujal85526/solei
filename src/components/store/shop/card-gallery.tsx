"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { StoreImage } from "@/modules/storefront/types";

/**
 * A product card's photos as a swipeable row (scroll-snap), with dots when there is more than one.
 * Lives inside the card's link: a tap opens the product, a sideways swipe shows the next photo.
 */
export function CardGallery({
  images,
  sizes,
  priority = false,
  imageClassName,
}: {
  images: StoreImage[];
  sizes: string;
  priority?: boolean;
  imageClassName?: string;
}) {
  const [active, setActive] = useState(0);
  const many = images.length > 1;

  return (
    <>
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
        className={cn(
          "absolute inset-0 flex",
          many &&
            "snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden",
        )}
      >
        {images.map((img, i) => (
          <div key={`${img.url}-${i}`} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={img.url}
              alt={i === 0 ? img.alt : ""}
              fill
              sizes={sizes}
              preload={priority && i === 0}
              className={cn("object-cover", imageClassName)}
            />
          </div>
        ))}
      </div>
      {many ? (
        <span
          aria-hidden
          className="pointer-events-none absolute start-0 end-0 top-auto bottom-3 flex justify-center gap-1.5"
        >
          {images.map((img, i) => (
            <span
              key={`${img.url}-dot-${i}`}
              className={cn(
                "size-1.5 rounded-full transition-colors duration-300",
                i === active ? "bg-primary" : "bg-primary/30",
              )}
            />
          ))}
        </span>
      ) : null}
    </>
  );
}
