import "server-only";
import { serverEnv } from "@/lib/env.server";
import { LogProvider } from "./log";
import { ResendProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailMessage, EmailProvider } from "./types";

let instance: EmailProvider | undefined;

export function emailProvider(): EmailProvider {
  if (instance) return instance;
  const env = serverEnv();
  instance = env.RESEND_API_KEY
    ? new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
    : new LogProvider();
  return instance;
}

/**
 * Outside production, only allow-listed recipients get real email (BUILD_PROMPT §10: no real sends
 * to anyone but test addresses). EMAIL_ALLOWLIST = comma-separated emails or @domains.
 */
export function recipientAllowed(email: string): boolean {
  const env = serverEnv();
  if (process.env.VERCEL_ENV === "production" || env.EMAIL_ALLOW_ALL === "1") return true;
  const list = (env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return emailProvider().name === "log";
  const addr = email.toLowerCase();
  return list.some((entry) => (entry.startsWith("@") ? addr.endsWith(entry) : addr === entry));
}
