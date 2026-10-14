import { useSyncExternalStore } from "react";
import { emptyDraft, WIZARD_STEPS, type BookingDraft } from "./schema";

/**
 * Wizard draft saved in localStorage (no account needed; cleared after submitting). Read with
 * `useSyncExternalStore` so the packages showcase and the wizard share it without a provider.
 */

export const DRAFT_STORAGE_KEY = "solei.booking.draft.v1";

export type DraftState = { draft: BookingDraft; step: number; clientUuid: string | null };

const EMPTY: DraftState = { draft: emptyDraft, step: 0, clientUuid: null };

/** Tolerant parse: unknown keys dropped, wrong types fall back to the empty draft's values. */
export function parseDraft(raw: string | null): DraftState {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<DraftState>;
    const src = (v.draft ?? {}) as Record<string, unknown>;
    const draft = { ...emptyDraft } as Record<string, unknown>;
    for (const [k, def] of Object.entries(emptyDraft)) {
      const val = src[k];
      if (Array.isArray(def)) {
        if (Array.isArray(val)) draft[k] = val.filter((x) => typeof x === "string");
      } else if (def !== null && typeof def === "object") {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          draft[k] = Object.fromEntries(
            Object.entries(val).filter(([, x]) => typeof x === "string"),
          );
        }
      } else if (typeof val === typeof def) {
        draft[k] = val;
      }
    }
    const step =
      typeof v.step === "number" && Number.isInteger(v.step)
        ? Math.min(Math.max(v.step, 0), WIZARD_STEPS.length - 1)
        : 0;
    return {
      draft: draft as BookingDraft,
      step,
      clientUuid: typeof v.clientUuid === "string" ? v.clientUuid : null,
    };
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: DraftState = EMPTY;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): DraftState {
  const raw = storage()?.getItem(DRAFT_STORAGE_KEY) ?? null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parseDraft(raw);
  }
  return cached;
}

function write(next: DraftState) {
  const raw = JSON.stringify(next);
  try {
    storage()?.setItem(DRAFT_STORAGE_KEY, raw);
  } catch {
    // Storage full/disabled: keep the in-memory copy for this visit.
  }
  cachedRaw = raw;
  cached = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DRAFT_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const draftStore = {
  get: read,
  update(patch: Partial<BookingDraft>) {
    const s = read();
    write({ ...s, draft: { ...s.draft, ...patch } });
  },
  setStep(step: number) {
    write({ ...read(), step });
  },
  ensureClientUuid(): string {
    const s = read();
    if (s.clientUuid) return s.clientUuid;
    const id = crypto.randomUUID();
    write({ ...s, clientUuid: id });
    return id;
  },
  reset() {
    try {
      storage()?.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    cachedRaw = null;
    cached = EMPTY;
    for (const l of listeners) l();
  },
};

/** `null` on the server and during hydration (the draft lives only in the browser). */
export function useDraft(): DraftState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
