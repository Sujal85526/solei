"use client";

import { useMemo, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/field";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { saveTemplateAction, sendTestAction } from "@/modules/notifications/actions";
import { renderTemplate, templateVariables } from "@/modules/notifications/render";
import { sampleVars } from "@/modules/notifications/samples";

export function TemplateEditor({
  template,
  siteUrl,
  testRecipient,
}: {
  template: {
    key: string;
    subject: string;
    body: string;
    enabled: boolean;
    variables: string[];
  };
  siteUrl: string;
  testRecipient: string;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [state, action, pending] = useFormAction(saveTemplateAction, null);
  const e = useActionToast(state);
  const [testing, startTest] = useTransition();

  const vars = useMemo(
    () => sampleVars(siteUrl, template.variables),
    [siteUrl, template.variables],
  );
  const preview = useMemo(() => renderTemplate({ subject, body }, vars), [subject, body, vars]);
  const unknown = useMemo(
    () => templateVariables(`${subject}\n${body}`).filter((v) => !template.variables.includes(v)),
    [subject, body, template.variables],
  );

  const insert = (name: string) => {
    const el = document.getElementById("body") as HTMLTextAreaElement | null;
    const token = `{{${name}}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: s, selectionEnd: end } = el;
    setBody((b) => b.slice(0, s) + token + b.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };

  const sendTest = () =>
    startTest(async () => {
      const fd = new FormData();
      fd.set("key", template.key);
      fd.set("subject", subject);
      fd.set("body", body);
      const r = await sendTestAction(null, fd);
      if (r.ok) toast.success(r.message ?? "Sent");
      else toast.error(r.error);
    });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <AdminSection title="Email">
        <form {...action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="key" value={template.key} />
          <Field label="Subject" htmlFor="subject" error={e.subject} required>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(ev) => setSubject(ev.target.value)}
              className="h-11"
            />
          </Field>
          <Field
            label="Message"
            htmlFor="body"
            error={e.body}
            required
            hint="**bold** · [link text](https://…) · blank line = new paragraph"
          >
            <Textarea
              id="body"
              name="body"
              value={body}
              onChange={(ev) => setBody(ev.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insert(v)}
                  className="bg-muted hover:bg-muted/70 rounded-full px-2.5 py-1 font-mono text-xs"
                  aria-label={`Insert ${v}`}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            {unknown.length ? (
              <p className="mt-2 text-sm text-[#8A5108]">
                Not available for this email (will be blank): {unknown.join(", ")}
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={template.enabled}
              className="accent-burgundy size-5"
            />
            Send this email
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save template"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={sendTest} disabled={testing}>
              <Send /> {testing ? "Sending…" : "Send test to me"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            The test uses example values and goes to {testRecipient}.
          </p>
        </form>
      </AdminSection>

      <AdminSection
        title="Preview"
        description="With example values."
        actions={<Badge variant="muted">Live</Badge>}
      >
        <p className="mb-3 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium" data-testid="preview-subject">
            {preview.subject}
          </span>
        </p>
        <iframe
          title="Email preview"
          srcDoc={preview.html}
          sandbox=""
          className="h-[32rem] w-full rounded-lg border bg-white"
        />
      </AdminSection>
    </div>
  );
}
