"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import {
  deleteCampaignAction,
  saveCampaignAction,
  sendCampaignAction,
  sendTestCampaignAction,
} from "@/modules/campaigns/actions";
import { readyToSend, withFooter } from "@/modules/campaigns/schema";
import { renderTemplate } from "@/modules/notifications/render";

export type SegmentOption = { id: string; name: string; emailable: number; total: number };

type Draft = {
  id?: string;
  name: string;
  subject: string;
  body: string;
  segmentId: string | null;
};

/**
 * Write a campaign: name, who it goes to, subject and message, with a live preview (the
 * unsubscribe line is always added). Save, send a test to yourself, then send.
 */
export function CampaignEditor({
  campaign,
  segments,
  testRecipient,
  eventNews,
}: {
  campaign?: Draft;
  segments: SegmentOption[];
  testRecipient: string;
  /** An event announcement: goes to the event news subscribers (this many), not a segment. */
  eventNews?: number;
}) {
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [segmentId, setSegmentId] = useState(campaign?.segmentId ?? "");
  const [state, action, pending] = useFormAction(saveCampaignAction, null);
  const e = useActionToast(state);
  const [testing, startTest] = useTransition();

  const audience = eventNews === undefined ? "segment" : "event_news";
  const segment =
    eventNews === undefined
      ? segments.find((s) => s.id === segmentId)
      : { id: "", name: "event news subscribers", emailable: eventNews, total: eventNews };
  const preview = useMemo(
    () =>
      renderTemplate(
        { subject, body: withFooter(body, audience) },
        {
          first_name: "Layla",
          unsubscribe_link: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/unsubscribe`,
        },
      ),
    [subject, body, audience],
  );
  // What's saved is what gets sent — sending checks the saved draft.
  const dirty =
    !campaign ||
    subject !== campaign.subject ||
    body !== campaign.body ||
    segmentId !== (campaign.segmentId ?? "");
  const problem = campaign
    ? readyToSend({ subject, body, segmentId: segmentId || null, audience })
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <AdminSection title="Email">
        <form {...action} className="flex flex-col gap-4" noValidate>
          {campaign?.id ? <input type="hidden" name="id" value={campaign.id} /> : null}
          <Field
            label="Name (staff only)"
            htmlFor="name"
            error={e.name}
            hint="e.g. Eid collection launch"
            required
          >
            <Input id="name" name="name" defaultValue={campaign?.name} className="h-11" />
          </Field>
          {eventNews !== undefined ? (
            <p className="text-sm">
              <span className="text-muted-foreground">Send to: </span>
              customers who asked for event news ({eventNews})
            </p>
          ) : null}
          <Field
            className={eventNews !== undefined ? "hidden" : undefined}
            label="Send to"
            htmlFor="segmentId"
            error={e.segmentId}
            hint={
              segment
                ? `${segment.emailable} of ${segment.total} customers in it agreed to email marketing — only they get it.`
                : "Build segments in Campaigns → New segment."
            }
          >
            <NativeSelect
              id="segmentId"
              name="segmentId"
              value={segmentId}
              onChange={(ev) => setSegmentId(ev.target.value)}
              className="[&_select]:h-11"
            >
              <option value="">Choose a segment…</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.emailable} reachable
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Subject" htmlFor="subject" error={e.subject}>
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
            hint="{{first_name}} · **bold** · [link text](https://…) · blank line = new paragraph. The unsubscribe line is added for you."
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
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : campaign ? "Save draft" : "Create draft"}
            </Button>
            {campaign?.id ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={testing || dirty}
                  onClick={() =>
                    startTest(async () => {
                      const r = await sendTestCampaignAction(campaign.id!);
                      if (r.ok) toast.success(r.message ?? "Test sent.");
                      else toast.error(r.error);
                    })
                  }
                >
                  <Send /> {testing ? "Sending…" : "Send test to me"}
                </Button>
                <ConfirmButton
                  variant="ghost"
                  destructive
                  title="Delete this draft?"
                  confirmLabel="Delete"
                  action={() => deleteCampaignAction(campaign.id!)}
                >
                  Delete
                </ConfirmButton>
              </>
            ) : null}
          </div>
          {campaign?.id ? (
            <p className="text-muted-foreground text-xs">
              {dirty
                ? "Save the draft to send a test or send it."
                : `The test goes to ${testRecipient}.`}
            </p>
          ) : null}
        </form>

        {campaign?.id ? (
          <div className="mt-6 border-t pt-5">
            {problem || dirty || !segment ? (
              <p className="text-muted-foreground text-sm">
                {dirty ? "Save first." : (problem ?? "Choose a segment.")}
              </p>
            ) : (
              <ConfirmButton
                variant="default"
                title={`Send to ${segment.emailable} customer${segment.emailable === 1 ? "" : "s"}?`}
                description={
                  audience === "event_news"
                    ? `"${subject}" goes to every customer who asked for event news. This can't be undone.`
                    : `"${subject}" goes to everyone in ${segment.name} who agreed to email marketing. This can't be undone.`
                }
                confirmLabel="Send now"
                action={() => sendCampaignAction(campaign.id!)}
              >
                <Send /> Send to {segment.emailable} customer{segment.emailable === 1 ? "" : "s"}
              </ConfirmButton>
            )}
          </div>
        ) : null}
      </AdminSection>

      <AdminSection
        title="Preview"
        description="As Layla would see it."
        actions={<Badge variant="muted">Live</Badge>}
      >
        <p className="mb-3 text-sm">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium">{preview.subject || "—"}</span>
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
