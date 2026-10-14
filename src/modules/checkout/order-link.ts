import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unguessable links for guests to view their order (confirmation, retry payment) without an
 * account: HMAC(orderId) truncated to 32 hex chars.
 */
export function orderToken(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`order:${orderId}`).digest("hex").slice(0, 32);
}

export function verifyOrderToken(
  orderId: string,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return false;
  const expected = Buffer.from(orderToken(orderId, secret), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
