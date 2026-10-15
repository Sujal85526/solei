"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import type { StoreImage } from "@/modules/storefront/types";

/**
 * Product gallery: photographs crossfade in place, chosen from thumbnails (a column over the photo
 * on wide screens, a plain row beneath it on phones) or by swiping on touch screens.
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
      className="bg-noir flex h-full flex-col"
    >
      <div
        className="relative aspect-[4/5] overflow-hidden sm:aspect-[4/3] lg:aspect-auto lg:flex-1"
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
          <Thumbs
            images={images}
            active={active}
            onPick={go}
            className="absolute start-8 top-24 hidden w-16 flex-col gap-3 lg:flex"
          />
        ) : null}
      </div>
      {many ? (
        <Thumbs
          images={images}
          active={active}
          onPick={go}
          className="flex gap-2 px-4 py-3 lg:hidden"
        />
      ) : null}
    </div>
  );
}

function Thumbs({
  images,
  active,
  onPick,
  className,
}: {
  images: StoreImage[];
  active: number;
  onPick: (i: number) => void;
  className: string;
}) {
  return (
    <ul className={cn("z-10", className)}>
      {images.map((img, i) => (
        <li key={`${img.url}-${i}`} className="w-16 shrink-0">
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={t.product.showImage(i + 1)}
            aria-current={i === active ? "true" : undefined}
            className={cn(
              "relative block aspect-square w-full overflow-hidden border transition-all duration-300",
              i === active ? "border-pearl" : "border-pearl/20 opacity-60 hover:opacity-100",
            )}
          >
            <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
          </button>
        </li>
      ))}
    </ul>
  );
}
