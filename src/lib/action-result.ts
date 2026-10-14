import { ZodError } from "zod";
import { PermissionError } from "@/lib/auth/session";

/** Uniform result for server actions consumed by forms. */
export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

/** Convert thrown errors into a safe, user-facing result (never leak internals). */
export function fail(err: unknown): ActionResult<never> {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  if (err instanceof UserError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
