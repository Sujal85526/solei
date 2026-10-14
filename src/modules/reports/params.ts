import { z } from "zod";

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 6;

const uuid = z.uuid();

/**
 * Event ids from `?ids=a,b` and/or repeated `?ids=a&ids=b` (checkbox forms). Invalid ids are
 * dropped, duplicates removed, order kept, capped at MAX_COMPARE.
 */
export function parseCompareIds(raw: string | string[] | null | undefined): string[] {
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(","));
  const ids: string[] = [];
  for (const v of values) {
    const id = v.trim().toLowerCase();
    if (uuid.safeParse(id).success && !ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, MAX_COMPARE);
}

/** `?day=` → a business day among the report days, else "all". */
export function parseScope(raw: string | string[] | null | undefined, days: string[]) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && days.includes(v) ? v : "all";
}

export const isUuid = (v: string) => uuid.safeParse(v).success;
