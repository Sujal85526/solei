import type { EmailProvider } from "@/providers/email/types";
import { renderTemplate, type TemplateVars } from "./render";

export type NotificationStatus = "sent" | "failed" | "skipped";

export type NotifyInput = {
  /** Recipient email. Empty → skipped (logged only when a related record is known). */
  to: string | null | undefined;
  vars: TemplateVars;
  customerId?: string | null;
  orderId?: string | null;
  bookingId?: string | null;
  /** Don't send this template again with the same key within `dedupeHours`. */
  dedupeKey?: string;
  dedupeHours?: number;
};

export type NotifyResult = { status: NotificationStatus; reason?: string };

export type TemplateRow = { subject: string; body: string; enabled: boolean };

export type LogRow = {
  template_key: string;
  recipient: string;
  subject: string | null;
  status: NotificationStatus;
  provider: string | null;
  provider_id: string | null;
  error: string | null;
  customer_id: string | null;
  order_id: string | null;
  booking_id: string | null;
  dedupe_key: string | null;
};

export type NotifierDeps = {
  loadTemplate: (key: string) => Promise<TemplateRow | null>;
  /** True when a non-failed send with this template + key exists since `since`. */
  sentSince: (key: string, dedupeKey: string, since: Date) => Promise<boolean>;
  writeLog: (row: LogRow) => Promise<void>;
  provider: () => EmailProvider;
  recipientAllowed: (email: string) => boolean;
  now?: () => Date;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Template → render → guard → send → log. Every outcome is logged in `notification_log`
 * (sent / failed / skipped with the reason) and nothing is ever thrown to the caller:
 * a broken email must never break a payment, a status change or a stock update.
 */
export function createNotifier(deps: NotifierDeps) {
  return async function notify(key: string, input: NotifyInput): Promise<NotifyResult> {
    const to = input.to?.trim().toLowerCase() ?? "";
    const base = {
      template_key: key,
      recipient: to || "—",
      customer_id: input.customerId ?? null,
      order_id: input.orderId ?? null,
      booking_id: input.bookingId ?? null,
      dedupe_key: input.dedupeKey ?? null,
    };
    let subject: string | null = null;
    let providerName: string | null = null;

    const log = async (
      status: NotificationStatus,
      extra: { error?: string | null; providerId?: string | null } = {},
    ) => {
      try {
        await deps.writeLog({
          ...base,
          subject,
          status,
          provider: providerName,
          provider_id: extra.providerId ?? null,
          error: extra.error ? extra.error.slice(0, 500) : null,
        });
      } catch (e) {
        console.error(`notification log failed (${key})`, e);
      }
    };
    const skip = async (reason: string) => {
      await log("skipped", { error: reason });
      return { status: "skipped", reason } as const;
    };

    try {
      const template = await deps.loadTemplate(key);
      if (!template) return await skip("Template not found");
      if (!template.enabled) return await skip("Template disabled");
      if (!to) return await skip("No email address");
      if (!EMAIL.test(to)) return await skip("Invalid email address");

      if (input.dedupeKey) {
        const now = deps.now?.() ?? new Date();
        const since = new Date(now.getTime() - (input.dedupeHours ?? 24) * 3_600_000);
        if (await deps.sentSince(key, input.dedupeKey, since)) {
          // Not logged: repeats would flood the outbox (e.g. every sale of a low-stock SKU).
          return { status: "skipped", reason: "Already sent recently" };
        }
      }

      const rendered = renderTemplate(template, input.vars);
      subject = rendered.subject;
      if (!deps.recipientAllowed(to)) return await skip("Recipient not on the email allowlist");

      const provider = deps.provider();
      providerName = provider.name;
      const res = await provider.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await log("sent", { providerId: res.id });
      return { status: "sent" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`notification ${key} failed`, message);
      await log("failed", { error: message });
      return { status: "failed", reason: message };
    }
  };
}

export type Notify = ReturnType<typeof createNotifier>;
