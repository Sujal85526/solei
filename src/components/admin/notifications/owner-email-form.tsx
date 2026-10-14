"use client";

import { Field } from "@/components/admin/field";
import { SubNav } from "@/components/admin/sub-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { saveOwnerEmailAction } from "@/modules/notifications/actions";

/** Where owner alerts (new order, new booking, low stock) are sent. */
export function OwnerEmailForm({ email }: { email: string | null }) {
  const [state, action, pending] = useFormAction(saveOwnerEmailAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
      <Field
        label="Owner alert email"
        htmlFor="ownerEmail"
        error={e.ownerEmail}
        hint="New orders, booking requests and low stock. Leave empty to turn owner alerts off."
        className="flex-1"
      >
        <Input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          defaultValue={email ?? ""}
          placeholder="owner@example.com"
          className="h-11"
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="sm:mb-6">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

export function NotificationTabs() {
  return (
    <SubNav
      items={[
        { href: "/admin/settings/notifications", label: "Emails" },
        { href: "/admin/settings/notifications/outbox", label: "Outbox" },
      ]}
    />
  );
}
