"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const media = window.matchMedia(REDUCED);
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
};

/** Live prefers-reduced-motion (false on the server). */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * Slideshow state: the current index, autoplay (never for prefers-reduced-motion) and a hold while
 * the pointer or focus is on the controls. Advances only while the tab is visible.
 */
export function useSlideshow(count: number, intervalMs: number) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const reduced = usePrefersReducedMotion();

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  const playing = !paused && !reduced;
  const running = playing && !held && count > 1;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) go(index + 1);
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [running, index, intervalMs, go]);

  return {
    index,
    count,
    running,
    playing,
    go,
    next: () => go(index + 1),
    prev: () => go(index - 1),
    togglePlaying: () => setPaused((p) => !p),
    hold: (on: boolean) => setHeld(on),
  };
}

export type Slideshow = ReturnType<typeof useSlideshow>;
