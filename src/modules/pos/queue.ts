"use client";

import type { PosSale } from "./schema";

/**
 * Offline sales queue in IndexedDB. Every sale is written here first, then sent; a sale only
 * leaves the queue when the server confirms it (idempotent by clientUuid, so retries are safe).
 */
export type QueuedSale = PosSale & { totalFils: number; error?: string; attempts: number };

const DB = "solei-pos";
const STORE = "sales";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientUuid" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const queue = {
  put: (sale: QueuedSale) => tx("readwrite", (s) => s.put(sale)),
  remove: (id: string) => tx("readwrite", (s) => s.delete(id)),
  all: () => tx<QueuedSale[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedSale[]>),
};

export type SendResult =
  | { status: "sent"; number: string }
  | { status: "rejected"; error: string }
  | { status: "offline" };

/** Try to send one queued sale. */
export async function send(sale: QueuedSale): Promise<SendResult> {
  try {
    const res = await fetch("/api/pos/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sale),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      await queue.remove(sale.clientUuid);
      return { status: "sent", number: body.number };
    }
    if (res.status === 422) {
      await queue.put({ ...sale, error: body.error ?? "Rejected", attempts: sale.attempts + 1 });
      return { status: "rejected", error: body.error ?? "Rejected" };
    }
    await queue.put({ ...sale, attempts: sale.attempts + 1 });
    return { status: "offline" };
  } catch {
    return { status: "offline" };
  }
}
