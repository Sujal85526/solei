"use client";

import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import { deltaText, type LineOptions, type OptionGroup } from "@/modules/catalog/options";

type Choice = Omit<LineOptions[number], "groupId">;

/**
 * One choice group of a customisable product: a short text (names on a tag), or options to pick —
 * as photo tiles when any option has a photo (packaging, designs), otherwise as chips. Shared by
 * the product page and the giveaway flow.
 */
export function OptionChoices({
  group: g,
  value,
  onChange,
  legend,
}: {
  group: OptionGroup;
  value: Choice | undefined;
  onChange: (next: Choice) => void;
  /** Replaces the group name as the heading (e.g. a numbered step). */
  legend?: React.ReactNode;
}) {
  const tiles = g.options.some((o) => o.imageUrl);
  const toggle = (id: string, on: boolean) => {
    const current = value?.optionIds ?? [];
    onChange({
      optionIds:
        g.kind === "single" ? [id] : on ? current.filter((x) => x !== id) : [...current, id],
    });
  };

  return (
    <fieldset className="mb-3 flex flex-col gap-2.5">
      <legend className="eyebrow text-primary/60 mb-2.5 text-[0.6rem]">
        {legend ?? g.name}
        {g.required ? null : <span className="normal-case"> · {t.product.optional}</span>}
      </legend>
      {g.kind === "text" ? (
        <div className="flex flex-col gap-1">
          <input
            aria-label={g.name}
            maxLength={g.maxLength}
            value={value?.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            className="border-primary/25 focus:border-primary h-11 border bg-white/70 px-3 text-sm outline-none"
          />
          <span className="text-primary/50 self-end text-[0.65rem]">
            {(value?.text ?? "").length}/{g.maxLength}
          </span>
        </div>
      ) : tiles ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {g.options.map((o) => {
            const on = value?.optionIds?.includes(o.id) ?? false;
            return (
              <label
                key={o.id}
                className={cn(
                  "has-[:focus-visible]:ring-primary/30 flex cursor-pointer flex-col border bg-white/60 transition-colors has-[:focus-visible]:ring-2",
                  on
                    ? "border-primary ring-primary ring-1"
                    : "border-primary/20 hover:border-primary",
                )}
                data-testid="option-tile"
              >
                <input
                  type={g.kind === "single" ? "radio" : "checkbox"}
                  name={`option-${g.id}`}
                  checked={on}
                  onChange={() => toggle(o.id, on)}
                  className="sr-only"
                />
                <span className="bg-primary/5 relative block aspect-square overflow-hidden">
                  {o.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded storage URLs
                    <img
                      src={o.imageUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </span>
                <span className="text-primary px-2.5 py-2 text-xs leading-snug">
                  {o.label}
                  {o.priceDeltaFils ? (
                    <span className="numeric block opacity-70">{deltaText(o.priceDeltaFils)}</span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {g.options.map((o) => {
            const on = value?.optionIds?.includes(o.id) ?? false;
            return (
              <label
                key={o.id}
                className={cn(
                  "has-[:focus-visible]:ring-primary/30 inline-flex min-h-10 cursor-pointer items-center gap-1 border px-3.5 py-2 text-xs transition-colors has-[:focus-visible]:ring-2",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/25 text-primary hover:border-primary",
                )}
              >
                <input
                  type={g.kind === "single" ? "radio" : "checkbox"}
                  name={`option-${g.id}`}
                  checked={on}
                  onChange={() => toggle(o.id, on)}
                  className="sr-only"
                />
                {o.label}
                {o.priceDeltaFils ? (
                  <span className="numeric opacity-70"> {deltaText(o.priceDeltaFils)}</span>
                ) : null}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
