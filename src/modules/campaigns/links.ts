import { createHmac, timingSafeEqual } from "node:crypto";

/** Per-customer unsubscribe link token for campaign emails. */
export function unsubscribeToken(customerId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`unsubscribe:${customerId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(
  customerId: string,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return false;
  const expected = Buffer.from(unsubscribeToken(customerId, secret), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
