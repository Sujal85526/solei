"use client";

import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { saveHelpTopicAction } from "@/modules/help/actions";
import type { HelpTopic } from "@/modules/help/schema";

/** Edit one Help page topic: title, "last updated" label, wording and whether it's shown. */
export function HelpTopicForm({ topic }: { topic: HelpTopic }) {
  const [state, action, pending] = useFormAction(saveHelpTopicAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} noValidate className="bg-card flex flex-col gap-5 rounded-xl border p-6">
      <input type="hidden" name="id" value={topic.id} />
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field label="Title" htmlFor="title" error={e.title} required>
          <Input id="title" name="title" defaultValue={topic.title} className="h-11" />
        </Field>
        <Field
          label="Last updated"
          htmlFor="updatedLabel"
          error={e.updatedLabel}
          hint="e.g. 1 November 2026 — leave empty to hide"
        >
          <Input
            id="updatedLabel"
            name="updatedLabel"
            defaultValue={topic.updatedLabel ?? ""}
            className="h-11"
          />
        </Field>
      </div>
      <Field
        label="Wording"
        htmlFor="body"
        error={e.body}
        hint={
          <>
            Start a line with <code>## </code> for a heading and <code>1. </code> for a numbered
            point; leave a blank line between paragraphs. Anything in <code>[square brackets]</code>{" "}
            shows as a “to confirm” marker — replace it with the real detail when you have it.
          </>
        }
      >
        <Textarea
          id="body"
          name="body"
          defaultValue={topic.body}
          rows={22}
          className="font-mono text-[0.8rem] leading-relaxed"
        />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={topic.published}
          className="accent-burgundy size-4"
        />
        Show this topic on the Help page
      </label>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
