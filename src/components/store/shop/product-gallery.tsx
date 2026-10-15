"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import type { StoreImage } from "@/modules/storefront/types";

/**
 * Product gallery on the dark side of the product page: photographs crossfade in place, chosen from
 * thumbnails (a column over the photo on wide screens, a row along its foot on phones) or by
 * swiping on touch screens.
 */
export function ProductGallery({ images, name }: { images: StoreImage[]; name: string }) {
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;
  const go = (i: number) => setActive((i + images.length) % images.length);

  return (
    <div
      aria-label={t.product.gallery}
      aria-roledescription={many ? "carousel" : undefined}
      className="bg-noir relative h-full min-h-[inherit] overflow-hidden"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {images.map((img, i) => (
        <div
          key={`${img.url}-${i}`}
          aria-hidden={i !== active}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-(--ease-soft)",
            i === active ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            src={img.url}
            alt={img.alt || name}
            fill
            preload={i === 0}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-[2400ms] ease-(--ease-soft)",
              i === active ? "scale-100" : "scale-[1.04]",
            )}
          />
        </div>
      ))}

      {many ? (
        <ul className="absolute inset-x-4 bottom-4 z-10 flex gap-2 lg:inset-x-auto lg:start-8 lg:top-8 lg:bottom-auto lg:w-16 lg:flex-col lg:gap-3">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`} className="flex-1 lg:flex-none">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t.product.showImage(i + 1)}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "relative block aspect-[4/3] w-full overflow-hidden rounded-[2px] border transition-all duration-300 lg:aspect-square",
                  i === active ? "border-pearl" : "border-pearl/25 opacity-70 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
