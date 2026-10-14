import "server-only";
import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./types";

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  constructor(
    apiKey: string,
    private from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(m: EmailMessage) {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return { id: data?.id ?? null };
  }
}
