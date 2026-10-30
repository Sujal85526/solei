import { mkdir, rmdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Run `fn` while no other Playwright worker runs code under the same lock name. For tests that
 * flip a shop-wide switch (e.g. the points programme) and would otherwise turn it off under a
 * test running in another project. `mkdir` is atomic, so the directory is the lock; a lock older
 * than `staleMs` (a crashed worker) is taken over.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>, staleMs = 180_000) {
  const dir = join(tmpdir(), `solei-e2e-lock-${name}`);
  for (;;) {
    try {
      await mkdir(dir);
      break;
    } catch {
      const age = await stat(dir).then(
        (s) => Date.now() - s.mtimeMs,
        () => 0,
      );
      if (age > staleMs) await rmdir(dir).catch(() => {});
      else await new Promise((r) => setTimeout(r, 500));
    }
  }
  try {
    return await fn();
  } finally {
    await rmdir(dir).catch(() => {});
  }
}
