"use client";

import { useEffect, useRef } from "react";

/**
 * Storefront cursor: a small airliner that follows the pointer, turns to face the way it's
 * moving and leaves a fading dotted gold contrail (the dotted line from the passport page).
 * Pink and slightly larger over links and buttons; hidden over text fields so typing keeps the
 * text caret. Mouse/trackpad + motion allowed only — otherwise the static plane cursor in
 * globals.css applies. Everything runs in one rAF loop on transforms and a canvas; no re-renders.
 */

const TRAIL_MS = 750;
const DOT_GAP = 7;
const REST_ANGLE = -45;
const CLICKABLE =
  'a[href], button:not(:disabled), [role="button"], label[for], summary, select, input[type="checkbox"], input[type="radio"]';
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="submit"]), textarea';

type Dot = { x: number; y: number; t: number };

/** Any angle → -180…180, so the plane always turns the short way round. */
const wrap = (a: number) => (((a % 360) + 540) % 360) - 180;

export function PlaneCursor() {
  const planeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || calm.matches) return;
    const plane = planeRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!plane || !canvas || !ctx) return;

    const root = document.documentElement;
    root.classList.add("plane-cursor-on");

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let x = -100;
    let y = -100;
    let angle = REST_ANGLE;
    let target = REST_ANGLE;
    let scale = 1;
    let hover = false;
    let pressed = false;
    let hidden = true;
    let lastMove = 0;
    const dots: Dot[] = [];
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const now = performance.now();
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const dist = Math.hypot(dx, dy);
      if (!hidden && dist > 2) {
        target = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        // Lay dots evenly along the path, however fast the pointer moves.
        const last = dots.at(-1);
        const from = last ?? { x, y };
        let gap = Math.hypot(e.clientX - from.x, e.clientY - from.y);
        let px = from.x;
        let py = from.y;
        while (gap >= DOT_GAP) {
          px += ((e.clientX - px) / gap) * DOT_GAP;
          py += ((e.clientY - py) / gap) * DOT_GAP;
          dots.push({ x: px, y: py, t: now });
          gap -= DOT_GAP;
        }
      }
      x = e.clientX;
      y = e.clientY;
      lastMove = now;
      if (hidden) {
        hidden = false;
        dots.length = 0;
      }
      const el = e.target instanceof Element ? e.target : null;
      hover = !!el?.closest(CLICKABLE);
      plane.dataset.hidden = el?.closest(TEXT_FIELD) ? "true" : "false";
      plane.dataset.hover = hover ? "true" : "false";
    };
    const onLeave = () => {
      hidden = true;
      plane.dataset.hidden = "true";
    };
    const onDown = () => (pressed = true);
    const onUp = () => (pressed = false);

    const tick = () => {
      const now = performance.now();
      // Drift back to the resting tilt once the pointer has been still for a moment.
      if (now - lastMove > 450) target = REST_ANGLE;
      angle = wrap(angle + wrap(target - angle) * 0.18);
      const want = (hover ? 1.18 : 1) * (pressed ? 0.86 : 1);
      scale += (want - scale) * 0.25;
      plane.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg) scale(${scale})`;

      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      while (dots.length && now - dots[0].t > TRAIL_MS) dots.shift();
      for (const d of dots) {
        const life = 1 - (now - d.t) / TRAIL_MS;
        ctx.globalAlpha = life * 0.75;
        ctx.fillStyle = "#B08D57";
        ctx.beginPath();
        ctx.arc(d.x, d.y, 0.6 + life * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", resize);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("plane-cursor-on");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden className="plane-cursor-trail" />
      <div ref={planeRef} aria-hidden className="plane-cursor" data-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path
            d="M12 1c.9 0 1.4 1 1.4 2.2V9l8.6 5v2l-8.6-2.7v5.3l2.6 2v1.6L12 21l-4 1.2v-1.6l2.6-2v-5.3L2 16v-2l8.6-5V3.2C10.6 2 11.1 1 12 1Z"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}
