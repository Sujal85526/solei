import { normalizePhone } from "@/lib/phone";

/**
 * How a free-text customer search is matched:
 * - phone-looking input ("050 123 4567", "+971 50…", "0501") matches the stored E.164 phone by
 *   its digits, so local formats find `+971501234567`;
 * - anything else matches name or email (case-insensitive, partial).
 */
export type CustomerSearch =
  { kind: "phone"; digits: string } | { kind: "text"; text: string } | null;

const PHONE_CHARS = /^[+\d\s\-().]+$/;

export function parseCustomerSearch(input: string | null | undefined): CustomerSearch {
  const q = (input ?? "").trim();
  if (!q) return null;

  const digits = q.replace(/\D/g, "");
  if (PHONE_CHARS.test(q) && digits.length >= 3) {
    const full = normalizePhone(q);
    if (full.ok) return { kind: "phone", digits: full.e164.slice(1) };
    // Partial number: drop the international (00) or trunk (0) prefix so "0501" matches "+971501…".
    const fragment = q.trim().startsWith("+")
      ? digits
      : digits.replace(/^00/, "").replace(/^0/, "");
    return { kind: "phone", digits: fragment || digits };
  }

  // PostgREST filter syntax uses , ( ) " \ and LIKE uses % _ as wildcards — strip them.
  const text = q
    .replace(/[,()"\\%_*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? { kind: "text", text } : null;
}

/** PostgREST `or` filter for a parsed search (column names of customers / customer_summary). */
export function customerSearchFilter(search: Exclude<CustomerSearch, null>): string {
  if (search.kind === "phone") return `phone.ilike.%${search.digits}%`;
  return `name.ilike.%${search.text}%,email.ilike.%${search.text}%`;
}
