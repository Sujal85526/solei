"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

/**
 * Reveal-on-scroll. A single shared IntersectionObserver marks elements `data-revealed`; the
 * fade-and-rise itself is CSS (globals.css "Reveal / Stagger"), so this stays tiny and never
 * re-renders. Nothing is hidden until the component has mounted, and prefers-reduced-motion users
 * get the content instantly (the CSS hidden state only applies with `no-preference`).
 */

type Tag = "div" | "ul" | "ol" | "li" | "header" | "p";

const STAGGER_STEP_MS = 90;
let observer: IntersectionObserver | null = null;

/** Already on screen at mount (e.g. scrolled before hydration): show as-is instead of hiding. */
function inViewNow(rects: DOMRect[]) {
  const h = window.innerHeight;
  return rects.map((r) => r.top < h * 0.9 && r.bottom > 0);
}

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      // Elements that enter together are staggered in DOM order.
      let batch = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const step = Number(el.dataset.revealStep ?? STAGGER_STEP_MS);
        const base = Number(el.dataset.revealBase ?? 0);
        el.style.setProperty("--reveal-delay", `${base + batch * step}ms`);
        if (el.dataset.revealItem !== undefined) batch += 1;
        el.setAttribute("data-revealed", "");
        observer?.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0 },
  );
  return observer;
}

type CommonProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: Tag;
  children: ReactNode;
  /** Extra delay in ms before this element (or the first staggered child) animates. */
  delay?: number;
};

/** Fades and rises a single block in when it scrolls into view. */
export function Reveal({ as = "div", children, delay = 0, ...rest }: CommonProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (inViewNow([el.getBoundingClientRect()])[0]) return;
    el.dataset.revealBase = String(delay);
    el.dataset.reveal = "ready";
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, [delay]);
  const Tag = as;
  return (
    <Tag {...rest} ref={ref as React.Ref<never>} data-reveal="">
      {children}
    </Tag>
  );
}

/**
 * Reveals each direct child as it scrolls into view; children entering together are staggered.
 * `variant="stamp"` presses children in like rubber stamps (scale from 1.15 + slight rotate).
 */
export function Stagger({
  as = "div",
  children,
  delay = 0,
  step = STAGGER_STEP_MS,
  variant = "rise",
  ...rest
}: CommonProps & { step?: number; variant?: "rise" | "stamp" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getObserver();
    const children = Array.from(el.children) as HTMLElement[];
    const visible = inViewNow(children.map((c) => c.getBoundingClientRect()));
    const items = children.filter((_, i) => !visible[i]);
    for (const item of items) {
      item.dataset.revealItem = "";
      item.dataset.revealStep = String(step);
      item.dataset.revealBase = String(delay);
      io.observe(item);
    }
    return () => items.forEach((item) => io.unobserve(item));
  }, [delay, step]);
  const Tag = as;
  return (
    <Tag {...rest} ref={ref as React.Ref<never>} data-stagger={variant}>
      {children}
    </Tag>
  );
}
