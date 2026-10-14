import { cn } from "@/lib/utils";
import type { Slideshow } from "./use-slideshow";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Brand-layout counters: current slide at the start (goes back); next slide, a progress hairline
 * and the position at the end. Hover/focus holds the slideshow; a pause toggle appears on focus.
 */
export function HeroCounters({ show, intervalMs }: { show: Slideshow; intervalMs: number }) {
  const { index, count, running, playing } = show;
  return (
    <div
      className="text-pearl/75 absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[96rem] items-center justify-between gap-6 px-6 pb-6 text-[0.6rem] tracking-[0.3em] sm:px-10 sm:pb-7 sm:text-[0.65rem] lg:px-14"
      onMouseEnter={() => show.hold(true)}
      onMouseLeave={() => show.hold(false)}
      onFocus={() => show.hold(true)}
      onBlur={() => show.hold(false)}
    >
      <button
        type="button"
        onClick={show.prev}
        aria-label="Previous slide"
        className="numeric hover:text-pink min-h-11 transition-colors"
      >
        {pad(index + 1)}
      </button>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={show.togglePlaying}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          className="sr-only focus:not-sr-only focus:px-2"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={show.next}
          aria-label="Next slide"
          className="numeric hover:text-pink min-h-11 transition-colors"
        >
          {pad(((index + 1) % count) + 1)}
        </button>
        <span aria-hidden className="bg-pearl/25 relative h-px w-16 overflow-hidden sm:w-24">
          <span
            key={`${index}-${running}`}
            className={cn("bg-pearl absolute inset-y-0 start-0", running ? "" : "w-0")}
            style={
              running ? { animation: `solei-progress ${intervalMs}ms linear forwards` } : undefined
            }
          />
        </span>
        <span className="numeric">
          {pad(index + 1)} <span className="text-pearl/45">/ {pad(count)}</span>
        </span>
      </div>
    </div>
  );
}
