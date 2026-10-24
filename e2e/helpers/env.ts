import { readFileSync } from "node:fs";
import { join } from "node:path";

function readEnvFile(name: string): Record<string, string> {
  try {
    const raw = readFileSync(join(process.cwd(), name), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [
            l.slice(0, i).trim(),
            l
              .slice(i + 1)
              .trim()
              .replace(/^"|"$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}

/**
 * Read .env.local, overridden by .env.development.local (as `next dev` does), so tests reach the
 * same Supabase as the dev server. Playwright doesn't load either itself.
 */
export function localEnv(): Record<string, string> {
  return { ...readEnvFile(".env.local"), ...readEnvFile(".env.development.local") };
}

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
