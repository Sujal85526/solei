"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * next/image with a soft shimmer placeholder (cream → sand sweep, or burgundy on dark sections)
 * that crossfades to the photo once it has loaded. The loading state is written straight to the
 * DOM (no re-render), and nothing is hidden before hydration, so server-rendered images stay
 * visible without JavaScript. Don't use it for the LCP image.
 *
 * With `fill`, the wrapper fills the positioned parent; otherwise it wraps the image as a block.
 */
export function ShimmerImage({
  wrapperClassName,
  tone = "light",
  onLoad,
  onError,
  ...props
}: ImageProps & { wrapperClassName?: string; tone?: "light" | "dark" }) {
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = wrapper.current;
    const img = el?.querySelector("img");
    if (!el || !img) return;
    if (el.dataset.state !== "loaded") el.dataset.state = img.complete ? "loaded" : "loading";
  }, []);

  return (
    <span
      ref={wrapper}
      data-shimmer={tone}
      className={cn(
        "block overflow-hidden",
        props.fill ? "absolute inset-0" : "relative",
        wrapperClassName,
      )}
    >
      <Image
        {...props}
        alt={props.alt}
        onLoad={(e) => {
          if (wrapper.current) wrapper.current.dataset.state = "loaded";
          onLoad?.(e);
        }}
        onError={(e) => {
          // Let the browser's broken-image/alt rendering show rather than an endless shimmer.
          if (wrapper.current) wrapper.current.dataset.state = "loaded";
          onError?.(e);
        }}
      />
    </span>
  );
}
