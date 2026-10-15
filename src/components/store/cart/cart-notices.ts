import { t } from "@/content/en";
import type { CartDetailLine } from "@/modules/cart/details";

/** Gentle messages for lines whose quantity was reduced or that are no longer available. */
export function noticesFor(lines: CartDetailLine[]): string[] {
  return lines.flatMap((l) => {
    if (l.status === "clamped" && l.product) return [t.cart.noticeClamped(l.product.name, l.qty)];
    if (l.status === "sold_out" && l.product) return [t.cart.noticeSoldOut(l.product.name)];
    if (l.status === "unavailable") return [t.cart.noticeUnavailable];
    return [];
  });
}
