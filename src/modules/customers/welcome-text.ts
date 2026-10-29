/**
 * The sentence in the welcome email that changes with how many stickers the customer already has.
 * Plain text on purpose: template variables are never parsed as markdown.
 */
export function stampsLine(p: { collected: number; remaining: number }, reward: string): string {
  if (p.collected <= 0) {
    return "Every perfume you order, online or at one of our pop-ups, earns you a sticker — collect them towards a reward.";
  }
  const stickers = `${p.collected} ${p.collected === 1 ? "sticker" : "stickers"}`;
  if (p.remaining <= 0) {
    return `From your previous orders you've already collected ${stickers} — enough to unlock ${reward}. Just let us know when you'd like to redeem it.`;
  }
  return `From your previous orders you've already collected ${stickers} — just ${p.remaining} more to unlock ${reward}.`;
}
