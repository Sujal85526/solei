import "server-only";
import type { EmailMessage, EmailProvider } from "./types";

/** Development provider: prints the email instead of sending it (visible in Admin → Notifications → Outbox). */
export class LogProvider implements EmailProvider {
  readonly name = "log";
  async send(m: EmailMessage) {
    console.info(`[email:log] to=${m.to} subject="${m.subject}"`);
    return { id: null };
  }
}
