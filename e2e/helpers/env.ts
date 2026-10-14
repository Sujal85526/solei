import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Read .env.local (Playwright doesn't load it) so tests can reach local Supabase. */
export function localEnv(): Record<string, string> {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
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

export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
