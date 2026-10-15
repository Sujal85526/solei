import { Logo } from "@/components/brand";

/**
 * Homepage intro: the wordmark alone on burgundy; then the burgundy dissolves into the hero while
 * the wordmark drifts up, blurs and fades over it (~3 s). Server-rendered and CSS-only: hidden
 * unless the inline motion script set `data-intro` on <html>, so it costs no JavaScript, never
 * blocks the page underneath (which renders and paints normally) and ignores pointer events.
 */
export function IntroLoader() {
  return (
    <div
      aria-hidden
      className="intro-loader pointer-events-none fixed inset-0 z-[60] items-center justify-center"
    >
      <div className="intro-loader__bg bg-burgundy absolute inset-0" />
      <div className="intro-loader__mark relative">
        <Logo className="text-pink h-16 sm:h-20" title="" inline />
      </div>
    </div>
  );
}
