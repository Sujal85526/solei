import Image from "next/image";
import type { HeroSlide } from "@/content/home";
import { cn } from "@/lib/utils";

/**
 * The hero photographs, fixed to the viewport behind the whole page: the copy scrolls away and
 * the sections slide over them; see-through sections later on show them again.
 */
export function HeroBackdrop({ slides, index }: { slides: HeroSlide[]; index: number }) {
  return (
    <div aria-hidden className="fixed inset-0 z-0 bg-[#2a0610]">
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.image}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-(--ease-soft)",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            {/* Phones: the landscape photo sits in the lower part and fades into the wall colour,
                so the product stays whole under the copy. */}
            <div className="absolute inset-x-0 top-[30%] bottom-0 sm:top-0">
              <Image
                src={slide.image}
                alt=""
                fill
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "auto"}
                sizes="100vw"
                className={cn(
                  "object-cover transition-transform duration-[9000ms] ease-out motion-reduce:transition-none",
                  active ? "scale-100" : "scale-[1.08]",
                )}
                style={{ objectPosition: slide.focus }}
              />
              <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#2a0610] to-transparent sm:hidden" />
            </div>
          </div>
        );
      })}
      <div className="from-noir/80 via-noir/25 absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b to-transparent" />
      <div className="from-noir/70 absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent" />
      <div className="film-grain absolute inset-0" />
    </div>
  );
}
