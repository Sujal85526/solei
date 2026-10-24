import type { MessagingProvider } from "@/providers/messaging/types";
import type { LogRow, NotifyResult, TemplateRow } from "./notifier";
import { renderTemplate, type TemplateVars } from "./render";

/**
 * WhatsApp order updates: template → plain text → provider → outbox (channel `whatsapp`). Same
 * rules as email: every outcome is logged, nothing is thrown to the caller. While the owner has
 * WhatsApp updates switched off nothing happens and nothing is logged (no outbox noise).
 */

export type WhatsAppNotifyInput = {
  /** E.164 mobile. */
  to: string | null | undefined;
  vars: TemplateVars;
  customerId?: string | null;
  orderId?: string | null;
  dedupeKey?: string;
};

export type WhatsAppNotifierDeps = {
  enabled: () => Promise<boolean>;
  loadTemplate: (key: string) => Promise<TemplateRow | null>;
  sentSince: (key: string, dedupeKey: string, since: Date) => Promise<boolean>;
  writeLog: (row: LogRow & { channel: "whatsapp" }) => Promise<void>;
  provider: () => MessagingProvider;
  now?: () => Date;
};

const E164 = /^\+[1-9]\d{7,14}$/;

export function createWhatsAppNotifier(deps: WhatsAppNotifierDeps) {
  return async function notifyWhatsApp(
    key: string,
    input: WhatsAppNotifyInput,
  ): Promise<NotifyResult> {
    if (!(await deps.enabled())) return { status: "skipped", reason: "WhatsApp updates are off" };
    const to = input.to?.replace(/\s+/g, "") ?? "";
    let subject: string | null = null;
    let providerName: string | null = null;
    const log = async (
      status: NotifyResult["status"],
      error?: string,
      providerId?: string | null,
    ) => {
      try {
        await deps.writeLog({
          channel: "whatsapp",
          template_key: key,
          recipient: to || "—",
          subject,
          status,
          provider: providerName,
          provider_id: providerId ?? null,
          error: error ? error.slice(0, 500) : null,
          customer_id: input.customerId ?? null,
          order_id: input.orderId ?? null,
          booking_id: null,
          dedupe_key: input.dedupeKey ?? null,
        });
      } catch (e) {
        console.error(`whatsapp log failed (${key})`, e);
      }
    };
    try {
      const template = await deps.loadTemplate(key);
      if (!template) {
        await log("skipped", "Template not found");
        return { status: "skipped", reason: "Template not found" };
      }
      if (!template.enabled) {
        await log("skipped", "Template disabled");
        return { status: "skipped", reason: "Template disabled" };
      }
      if (!E164.test(to)) {
        await log("skipped", "No mobile number");
        return { status: "skipped", reason: "No mobile number" };
      }
      if (input.dedupeKey) {
        const since = new Date((deps.now?.() ?? new Date()).getTime() - 24 * 3_600_000);
        if (await deps.sentSince(key, input.dedupeKey, since)) {
          return { status: "skipped", reason: "Already sent recently" };
        }
      }
      const rendered = renderTemplate(template, input.vars);
      subject = rendered.subject;
      const provider = deps.provider();
      providerName = provider.name;
      const res = await provider.sendWhatsApp({ to, body: rendered.text });
      await log("sent", undefined, res.id);
      return { status: "sent" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await log("failed", message);
      return { status: "failed", reason: message };
    }
  };
}
