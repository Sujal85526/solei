import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariantsBase = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-(--ease-soft) outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Burgundy — the main call to action. */
        default: "bg-primary text-primary-foreground hover:bg-burgundy-deep",
        /** Baby pink — secondary CTA on burgundy or cream. */
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--brand-pink),var(--brand-burgundy)_8%)]",
        outline:
          "border-burgundy/40 bg-transparent text-burgundy hover:border-burgundy hover:bg-burgundy/5 aria-expanded:bg-burgundy/5",
        /** Outline for dark (burgundy) backgrounds. */
        "outline-light":
          "border-pink/60 bg-transparent text-pink hover:border-pink hover:bg-pink/10",
        ghost: "text-current hover:bg-burgundy/6 aria-expanded:bg-burgundy/6",
        destructive:
          "bg-destructive text-white hover:bg-[color-mix(in_oklab,var(--destructive),black_12%)] focus-visible:ring-destructive/30",
        link: "h-auto px-0 text-burgundy underline decoration-gold underline-offset-4 hover:decoration-burgundy",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 gap-1.5 px-3 text-[0.8rem]",
        lg: "h-12 px-6 text-[0.95rem]",
        /** Editorial CTA: letter-spaced caps, with a soft light sweep on hover (`.sheen`). */
        cta: "sheen h-12 px-7 text-xs tracking-[0.22em] uppercase",
        /** POS / touch-first actions. */
        xl: "h-14 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Class names for button-styled elements (e.g. `<Link className={buttonVariants(...)}>`).
 * Always merged so variant classes override base ones (border colour etc.).
 */
function buttonVariants(props?: Parameters<typeof buttonVariantsBase>[0]) {
  return cn(buttonVariantsBase(props));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariantsBase>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariantsBase({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
