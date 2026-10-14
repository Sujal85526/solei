"use client";

import { createClient } from "@/lib/supabase/client";
import { EVENT_DOC_MAX_BYTES, eventObjectPath } from "@/modules/events/schema";

export const EVENT_DOCS_BUCKET = "event-docs";

/**
 * Upload straight from the browser to the private `event-docs` bucket (RLS checks the
 * permission), so large files never pass through a server action (DECISIONS T28).
 */
export async function uploadEventFile(
  eventId: string,
  kind: "docs" | "receipts",
  file: File,
  allowed: string[],
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!allowed.includes(file.type))
    return { ok: false, error: `${file.name}: this file type isn't supported.` };
  if (file.size > EVENT_DOC_MAX_BYTES) return { ok: false, error: `${file.name} is over 10 MB.` };
  const path = eventObjectPath(eventId, kind, file.name, crypto.randomUUID());
  const { error } = await createClient()
    .storage.from(EVENT_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: `Upload failed: ${error.message}` };
  return { ok: true, path };
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
