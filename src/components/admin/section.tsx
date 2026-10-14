import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** White card section used across admin forms and detail pages. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card rounded-xl border p-5 sm:p-6", className)}>
      {title || actions ? (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-foreground font-sans text-base font-semibold">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border p-4",
        tone === "warn" && "border-[#B4690E]/40 bg-[#B4690E]/5",
      )}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="numeric text-foreground mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
