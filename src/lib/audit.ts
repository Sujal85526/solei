import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";

/** Client IP of the current request (first hop of x-forwarded-for). */
export async function requestIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  return raw && /^[0-9a-fA-F:.]+$/.test(raw) ? raw : null;
}

/**
 * Write an audit entry from trusted server code where no authenticated DB session exists
 * (e.g. failed logins). Business mutations are audited inside Postgres instead.
 */
export async function writeSystemAudit(entry: {
  action: string;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  after?: Record<string, unknown>;
}) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? null,
      after: (entry.after ?? null) as never,
      ip: await requestIp(),
    });
  if (error) console.error("audit write failed", error);
}
