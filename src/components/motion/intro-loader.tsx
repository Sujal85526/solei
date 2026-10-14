import { Logo } from "@/components/brand";

/**
 * First-visit intro: burgundy panel, the wordmark with a light sweep across it and a gold hairline,
 * then the panel lifts away to reveal the hero (~1.8 s). Server-rendered and CSS-only: hidden unless
 * the inline motion script set `data-intro` on <html>, so it costs no JavaScript, never blocks the
 * page underneath (which renders and paints normally) and ignores pointer events.
 */
export function IntroLoader() {
  return (
    <div
      aria-hidden
      className="intro-loader bg-burgundy pointer-events-none fixed inset-0 z-[60] flex-col items-center justify-center"
    >
      <div className="intro-loader__mark flex flex-col items-center gap-7">
        <div className="relative">
          <Logo className="text-pink h-20 sm:h-24" title="" />
          {/* Highlight copy of the wordmark, revealed through a moving gradient mask. */}
          <Logo
            className="intro-loader__shine absolute inset-0 h-20 text-[#fff6f2] sm:h-24"
            title=""
          />
        </div>
        <span className="bg-gold/40 relative block h-px w-40 overflow-hidden sm:w-48">
          <span className="intro-loader__line bg-gold absolute inset-0 block" />
        </span>
      </div>
    </div>
  );
}
