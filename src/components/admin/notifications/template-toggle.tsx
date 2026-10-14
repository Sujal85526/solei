"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setTemplateEnabledAction } from "@/modules/notifications/actions";

/** On/off switch for one email template (optimistic). */
export function TemplateToggle({
  templateKey,
  name,
  enabled,
}: {
  templateKey: string;
  name: string;
  enabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useOptimistic(enabled);
  return (
    <Switch
      checked={checked}
      disabled={pending}
      aria-label={`${name} email`}
      onCheckedChange={(next) =>
        start(async () => {
          setChecked(next);
          const r = await setTemplateEnabledAction(templateKey, next);
          if (r.ok) toast.success(r.message ?? "Saved");
          else toast.error(r.error);
        })
      }
    />
  );
}
