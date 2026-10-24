import "server-only";
import { serverEnv } from "@/lib/env.server";
import { LogMessagingProvider } from "./log";
import type { MessagingProvider } from "./types";

export type { MessagingProvider, WhatsAppMessage } from "./types";

let instance: MessagingProvider | undefined;

/**
 * The WhatsApp sender. Only the stand-in exists today (MESSAGING_PROVIDER unset or "log"); a real
 * provider plugs in here once the client's WhatsApp Business account is approved (docs/DECISIONS
 * P2-21).
 */
export function messagingProvider(): MessagingProvider {
  if (instance) return instance;
  const name = serverEnv().MESSAGING_PROVIDER ?? "log";
  if (name !== "log") throw new Error(`Messaging provider "${name}" isn't set up yet`);
  instance = new LogMessagingProvider();
  return instance;
}
