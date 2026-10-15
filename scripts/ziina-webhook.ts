/**
 * One-time Ziina setup: register our payment webhook with Ziina.
 *   ZIINA_API_KEY=… pnpm ziina:webhook https://solei-rust.vercel.app
 * (defaults to NEXT_PUBLIC_SITE_URL). Ziina then notifies /api/webhooks/payments/ziina, where
 * every notification is re-checked against the Ziina API before an order is marked paid.
 */
const key = process.env.ZIINA_API_KEY;
const site = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
if (!key || !site.startsWith("https://")) {
  console.error("Usage: ZIINA_API_KEY=… pnpm ziina:webhook https://your-site");
  process.exit(1);
}
const url = `${site}/api/webhooks/payments/ziina`;
const res = await fetch("https://api-v2.ziina.com/api/webhook", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ url }),
});
console.log(res.status, await res.text(), "→", url);

export {};
