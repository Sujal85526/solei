"use client";

export type ScopeOption = { id: string; name: string; active: boolean };

/**
 * Tick boxes for categories or products (same look as the code form's scope). Either submits
 * with the form under `name`, or is controlled with `value` / `onChange` (bundle items).
 */
export function ScopeList({
  title,
  name,
  options,
  selected = [],
  value,
  onChange,
}: {
  title: string;
  name?: string;
  options: ScopeOption[];
  selected?: string[];
  value?: string[];
  onChange?: (ids: string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
        {title}
      </legend>
      <div className="grid max-h-72 gap-x-6 gap-y-2 overflow-y-auto sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.id} className="flex min-h-8 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.id}
              {...(value
                ? {
                    checked: value.includes(o.id),
                    onChange: (ev) =>
                      onChange?.(
                        ev.target.checked ? [...value, o.id] : value.filter((id) => id !== o.id),
                      ),
                  }
                : { defaultChecked: selected.includes(o.id) })}
              className="accent-primary size-4"
            />
            {o.name}
            {!o.active ? <span className="text-muted-foreground text-xs">(hidden)</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
