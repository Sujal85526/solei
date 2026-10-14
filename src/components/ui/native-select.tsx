import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Styled native <select> — best on phones/iPads (system picker) and works without JS. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="native-select"
        className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/20 aria-invalid:border-destructive h-10 w-full appearance-none rounded-md border ps-3 pe-9 text-sm outline-none focus-visible:ring-3 disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
      />
    </div>
  );
}
