import { Children, Fragment, isValidElement, type ReactNode } from "react";

export type SelectOption = { value: string; label: string; disabled: boolean; group?: string };

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

const text = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) => (typeof n === "string" || typeof n === "number" ? String(n) : ""))
    .join("");

/** The `<option>`s (inside fragments, arrays and `<optgroup>`s) a select was given, in order. */
export function optionsFromChildren(children: ReactNode, group?: string): SelectOption[] {
  return Children.toArray(children).flatMap((child): SelectOption[] => {
    if (!isValidElement(child)) return [];
    const props = child.props as OptionProps & { label?: string };
    if (child.type === Fragment) return optionsFromChildren(props.children, group);
    if (child.type === "optgroup") return optionsFromChildren(props.children, props.label);
    if (child.type !== "option") return [];
    const label = text(props.children);
    return [
      {
        value: String(props.value ?? label),
        label,
        disabled: Boolean(props.disabled),
        group,
      },
    ];
  });
}
