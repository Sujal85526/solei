"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "./input";

/** Password field with a show/hide eye toggle. */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pe-11", className)} />
      <EyeToggle visible={visible} onToggle={() => setVisible((v) => !v)} />
    </div>
  );
}

/** The eye button itself (also used by the storefront's light text field). */
function EyeToggle({
  visible,
  onToggle,
  className,
}: {
  visible: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      className={cn(
        "text-muted-foreground hover:text-foreground absolute inset-y-0 end-0 flex w-11 items-center justify-center transition-colors",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.5} />
    </button>
  );
}

export { PasswordInput, EyeToggle };
