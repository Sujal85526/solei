import type { SVGProps } from "react";

/** Brand icons (lucide no longer ships logos). Stroke style matches lucide at strokeWidth 1.5. */
export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      {...props}
    >
      <path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19.1L4 20z" strokeLinejoin="round" />
      <path
        d="M9 8.5c0 3.2 2.6 6.5 6.5 6.5l1-1.5-2-1-.9.8c-1.1-.4-2.1-1.4-2.5-2.5l.8-.9-1-2L9 8.5z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Gift bag with an arched ribbon handle — the Solei shopping bag, used for the cart. */
export function BagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M4.75 8.75h14.5l-.9 12.25H5.65z" />
      <path d="M8.75 11V7.25a3.25 3.25 0 0 1 6.5 0V11" />
    </svg>
  );
}

/** Menu mark: two hairlines, the lower one shorter — a quiet step instead of a hamburger. */
export function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M3.5 9h17" />
      <path d="M9.5 15h11" />
    </svg>
  );
}
