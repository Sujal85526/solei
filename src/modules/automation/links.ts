import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links in feedback request emails: "tell us" (the feedback page for one order) and
 * "stop feedback emails". The token binds the order id to the purpose.
 */
export type FeedbackLinkPurpose = "answer" | "stop";

export function feedbackToken(orderId: string, purpose: FeedbackLinkPurpose, secret: string) {
  return createHmac("sha256", secret)
    .update(`feedback:${purpose}:${orderId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyFeedbackToken(
  orderId: string,
  purpose: FeedbackLinkPurpose,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return false;
  const expected = Buffer.from(feedbackToken(orderId, purpose, secret), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
