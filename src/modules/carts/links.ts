import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed links in cart reminder emails: "return to your bag" and "stop these reminders". The
 * token binds the cart id to the purpose, so one can't be reused as the other.
 */
export type CartLinkPurpose = "restore" | "optout";

export function cartToken(cartId: string, purpose: CartLinkPurpose, secret: string): string {
  return createHmac("sha256", secret)
    .update(`cart:${purpose}:${cartId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyCartToken(
  cartId: string,
  purpose: CartLinkPurpose,
  token: string | null | undefined,
  secret: string,
): boolean {
  if (!token || !/^[0-9a-f]{32}$/.test(token)) return false;
  const expected = Buffer.from(cartToken(cartId, purpose, secret), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
