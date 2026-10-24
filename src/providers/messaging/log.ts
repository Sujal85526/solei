import "server-only";
import type { MessagingProvider, WhatsAppMessage } from "./types";

/** Stand-in until a WhatsApp Business account exists: prints the message (and it's logged in the outbox). */
export class LogMessagingProvider implements MessagingProvider {
  readonly name = "log";
  async sendWhatsApp(m: WhatsAppMessage) {
    console.info(`[whatsapp:log] to=${m.to} ${m.body.replace(/\s+/g, " ").slice(0, 160)}`);
    return { id: null };
  }
}
