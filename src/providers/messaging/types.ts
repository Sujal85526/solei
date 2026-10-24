/**
 * Messaging (WhatsApp Business). One interface so the real WhatsApp Cloud API (or a BSP such as
 * 360dialog / Twilio) can replace the stand-in without touching the callers.
 */
export type WhatsAppMessage = {
  /** E.164, e.g. +971501234567. */
  to: string;
  /** Plain text (rendered from the owner's template). */
  body: string;
  /**
   * The approved WhatsApp template behind this message, for providers that must send templates
   * outside the 24-hour customer window (Meta requires pre-approved templates).
   */
  template?: { name: string; params: string[] };
};

export type WhatsAppResult = { id: string | null };

export interface MessagingProvider {
  readonly name: string;
  sendWhatsApp(message: WhatsAppMessage): Promise<WhatsAppResult>;
}
