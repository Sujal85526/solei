"use client";

import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatPhone } from "@/lib/phone";
import { saveContactDetailsAction } from "@/modules/settings/actions";
import type { ContactDetails } from "@/modules/settings/schema";

/** Public contact details shown on the Contact page and in the footer. */
export function ContactForm({ contact }: { contact: ContactDetails }) {
  const [state, action, pending] = useFormAction(saveContactDetailsAction, null);
  const e = useActionToast(state);
  return (
    <form
      {...action}
      noValidate
      className="bg-card flex max-w-2xl flex-col gap-5 rounded-xl border p-6"
    >
      <Field
        label="Business WhatsApp"
        htmlFor="whatsappNumber"
        error={e.whatsappNumber}
        hint="The confirmed business number (not a personal one). Leave empty to hide WhatsApp."
      >
        <Input
          id="whatsappNumber"
          name="whatsappNumber"
          type="tel"
          defaultValue={contact.whatsapp ? formatPhone(contact.whatsapp) : ""}
          placeholder="+971 50 123 4567"
          className="h-11"
        />
      </Field>
      <Field
        label="Support email"
        htmlFor="contactEmail"
        error={e.contactEmail}
        hint="Leave empty to hide email."
      >
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          defaultValue={contact.email ?? ""}
          placeholder="hello@solei.ae"
          className="h-11"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Instagram handle" htmlFor="instagramHandle" error={e.instagramHandle}>
          <Input
            id="instagramHandle"
            name="instagramHandle"
            defaultValue={contact.instagramHandle ?? ""}
            placeholder="@solei.ad"
            className="h-11"
          />
        </Field>
        <Field label="Instagram link" htmlFor="instagramUrl" error={e.instagramUrl}>
          <Input
            id="instagramUrl"
            name="instagramUrl"
            type="url"
            defaultValue={contact.instagramUrl ?? ""}
            placeholder="https://www.instagram.com/solei.ad/"
            className="h-11"
          />
        </Field>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
