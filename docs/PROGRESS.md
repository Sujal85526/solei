# Progress

Phase 1 milestones (one branch + PR each, in order). See `docs/BUILD_PROMPT.md` §9.

| # | Branch | Status | PR |
|---|---|---|---|
| 0 | `chore/bootstrap` | ✅ merged | [#1](https://github.com/Sujal85526/solei/pull/1) |
| 1 | `feat/design-system` | ✅ merged | [#2](https://github.com/Sujal85526/solei/pull/2) |
| 2 | `feat/homepage` | ✅ merged | [#3](https://github.com/Sujal85526/solei/pull/3) |
| 3 | `feat/schema-core` | ✅ merged | [#4](https://github.com/Sujal85526/solei/pull/4) |
| 4 | `feat/admin-auth-staff` | ✅ merged | [#5](https://github.com/Sujal85526/solei/pull/5) |
| 5 | `feat/admin-catalog-inventory` | ✅ merged | [#8](https://github.com/Sujal85526/solei/pull/8) |
| 6 | `feat/storefront-shop-cart` | ✅ merged | [#7](https://github.com/Sujal85526/solei/pull/7) |
| 7 | `feat/checkout-payments` | ✅ merged | [#9](https://github.com/Sujal85526/solei/pull/9) |
| 8 | `feat/orders-admin-notifications` | ✅ merged | [#14](https://github.com/Sujal85526/solei/pull/14) |
| 9 | `feat/manual-orders-payment-links` | ✅ merged | [#17](https://github.com/Sujal85526/solei/pull/17) |
| 10 | `feat/customers` | ✅ merged | [#15](https://github.com/Sujal85526/solei/pull/15) |
| 11 | `feat/event-calendar` | ✅ merged | [#10](https://github.com/Sujal85526/solei/pull/10) |
| 12 | `feat/event-pos` | ✅ merged | [#20](https://github.com/Sujal85526/solei/pull/20) |
| 13 | `feat/event-reports` | ✅ merged | [#18](https://github.com/Sujal85526/solei/pull/18) |
| 14 | `feat/event-booking` | ✅ merged | [#16](https://github.com/Sujal85526/solei/pull/16) |
| 15 | `feat/loyalty-passport` | ✅ merged | [#19](https://github.com/Sujal85526/solei/pull/19) |
| 16 | `feat/dashboard-exports` | ✅ merged | [#21](https://github.com/Sujal85526/solei/pull/21) |
| 17 | `chore/hardening` | ⬜ | |

## Current notes
- **CI is paused** (manual-only workflow) at the user's request — merge after local checks; re-enable in M17.
- **Dev DB is hosted** (see DECISIONS T38): `.env.local` points at `https://ljjpyjzkbexucaqmxbas.supabase.co`.
  Push new migrations with `SUPABASE_ACCESS_TOKEN=… SUPABASE_DB_PASSWORD=… pnpm exec supabase db push`
  (both in the macOS Keychain: `supabase-access-token`, `supabase-solei-db-password`). Run e2e in CI (or start
  local Supabase only when needed).
- Local admin logins (dev seed only): `owner@solei.test` / `manager@solei.test` / `sales@solei.test`, password
  `Solei-dev-2026`. Owner TOTP secret `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` (add to an authenticator app);
  manager is asked to enrol TOTP on first login. Emails (invites, resets) land in Mailpit: http://127.0.0.1:54324.
- Local Supabase: analytics disabled and auth rate limits raised in `supabase/config.toml` (dev only — the
  analytics container restart loop starved GoTrue on Docker for Mac).
- Schema: `supabase/migrations/2026101400000{1..9}_*.sql`; DB tests `pnpm exec supabase test db`; demo seed is
  generated from `src/modules/content/seed.ts` via `pnpm db:seed:generate`.
- Local Supabase: `pnpm db:start`; copy keys from `pnpm exec supabase status` into `.env.local` (see `.env.example`).

## Handoff — storefront design state (2026-10-15)
Client feedback rounds after the milestones (PRs #22–#35). The client wants it **minimal** (content will be made
admin-editable later, so avoid extra sections). Current storefront:
- **Header** (`site-header.tsx`): frosted glass on every page; left Home · Collection · Plan your event (desktop),
  menu icon on the left on phones (baby-pink drawer from the left, `site-menu-drawer.tsx`); right: account, bag
  (opens the cart drawer), menu (desktop dropdown). Shared `SideDrawer` for phone menu, shop filters and cart.
- **Intro loader**: every homepage load; burgundy panel with the wordmark, dissolves into the hero (Overlay-style).
- **Home** (`app/(store)/page.tsx`): pinned single-image hero (Cannes bottle) → Our philosophy (Soho portrait) →
  Different places, Same feeling (sunset window) → Signature Scents shelf (one photo cut into Capri / Marbella /
  Verona tiles, each links to its product) → More than a fragrance (bag photo + early-access sign-up). No ticker,
  pop-ups, events or passport bands.
- **Collection** (`/shop`): sprays-and-flowers hero (compact on phones), "All fragrances — 08" + Filter
  (category + price sort only); phones get a filter icon → drawer from the right. Cards: square photo, serif
  name, hairline, price, round + (no type line).
- **Product page**: photo (desktop thumbnail column, phone dot pill) beside a blush panel — one-line name
  ("Cannes *Eau de parfum*"), price, Add to cart (no price on the button), Buy now, Fragrance notes / Shipping &
  returns / Details (description lives in Details); then You may also like (no View all). No scent section.
- **Plan your event**: locked — "Soon" tag in nav/menu/footer, `/events` is a Coming soon card (T97).
- **Accounts** (T93–T95): header person icon → dropdown (Welcome / Solei · Sign in · Create account; signed in:
  name · My account · Orders · Sign out). Sign in / create account open a light drawer from the right; sign-up
  verifies the email with a 6-digit code (in the `pnpm dev` log until Resend is set up). `/account`: compact —
  order history, details and address rows with Edit.
- **Checkout** (T96): light page with its own minimal header; sign in / create account first, then the
  prefilled delivery form ("Save this address", delivery note on demand) → hosted payment.
- **Cart drawer** (`cart-drawer.tsx`): Your Cart (n), free-shipping progress, lines with − n + and bin, Subtotal,
  Shipping "Calculated at checkout" (no Total), Proceed to checkout, trust row. No gift note.
- Product photos in the DB are light studio renders; the client's references use dark editorial shots — waiting
  on dark product photography. Lining numerals for the serif (old-style "1" looked like "I").
- **Working style**: one change at a time, commit locally, deploy only when the user says "deploy"
  (`~/.solei-tools/ship.sh "<title>" <body.md>` → PR → squash-merge → Vercel auto-deploys main). Restart
  `pnpm dev` with `rm -rf .next` if CSS changes don't show (Turbopack served stale CSS several times).
- **Admin for client testing**: https://solei-rust.vercel.app/admin/login — `client@solei.test` (password in
  Keychain `solei-client-test-password`); 2FA is OFF on the dev DB (see carry-over below).

## Carry-overs
- **Ziina payments (client's gateway):** code is ready (`src/providers/payment/ziina.ts`). To go live, set on
  Vercel `PAYMENT_PROVIDER=ziina`, `ZIINA_API_KEY=…` (token with `write_payment_intents`; `ZIINA_TEST_MODE=1`
  first for test payments), then run once `ZIINA_API_KEY=… pnpm ziina:webhook https://<site>`. Until then the
  site keeps the mock test checkout.
- **Account test code (remove at launch):** until Resend is set up, `ACCOUNT_TEST_CODE=123456` (local
  `.env.local` + Vercel production) verifies any sign-up / reset — so emails aren't really verified and a
  passport could be claimed by email. It switches off automatically once `RESEND_API_KEY` is set; delete the
  variable then.
- **Contact details (client 2026-10-16):** WhatsApp 050 470 8053, support + owner-alert email
  soleiperfumes@gmail.com, Instagram @solei.ad — in Admin → Settings → Contact details and in the
  Shipping/Privacy policies (migration `20261016000002_contact_details.sql`).
- **Resend (account codes + notifications):** set `RESEND_API_KEY` and `EMAIL_FROM` (client's domain, verified
  in Resend) locally and on Vercel; until then codes only appear in the server log. Outside production only
  `EMAIL_ALLOWLIST` recipients get real email (`EMAIL_ALLOW_ALL=1` for client testing).
- **M17 (accounts):** rate-limit sign-up / resend-code / forgot-password per email and IP (codes are
  admin-generated, so Supabase's own email limits don't apply). Dev DB test account:
  `ui-test-1792066208809@solei.test` / `Solei-test-2026` (one mock order) — delete before launch.
- **M17 (security) — re-enable 2FA:** on 2026-10-15 two-factor was switched off for the owner and manager roles on
  the hosted dev DB so the client can test (`update roles set requires_mfa = false where key in ('owner','manager')`).
  Turn it back on before launch (Admin → Staff → roles, or set `requires_mfa = true`). Client test login:
  `client@solei.test` (password in Keychain `solei-client-test-password`).
- **M13 (reports):** hosted dev DB keeps three demo events named "Report Test — …" (POS-style sales, refunds, a
  cancelled sale, stock allocation/close-out, expenses) for trying the reports. `/admin/reports` will gain
  dashboard-style reports in M16; the POS (M12) only needs to stamp `event_id` / `event_day` / cost snapshots.
- ~~**M8 (notifications):** low-stock alert email to the owner~~ — done in M8: `owner_low_stock` after paid
  orders and after damage / correction / transfer actions (one per SKU per 24 h).
- **M9 (manual orders):** use `record_payment` for "paid now / partial"; email templates `payment_received` /
  `order_confirmation` already fire from `src/modules/orders/notify.ts`. Cancel's "Return the items to stock"
  toggle assumes non-`pending_payment` orders have stock movements — revisit if manual orders deduct stock
  before payment.
- **M10/M14/M15:** `booking_received`, `quote_sent`, `booking_confirmed`, `owner_new_booking`,
  `passport_stamp`, `reward_unlocked` templates are seeded; call `notify()` from those milestones. Loyalty
  reversal hooks into `after_order_cancelled()`.
- **M7/M12:** call `updateTag("stock")` / `revalidateTag("stock")` after sales so storefront availability refreshes.
- **M9/M12 (manual orders, POS):** attach customers with `CustomerPicker`
  (`src/components/admin/customers/customer-picker.tsx`, `source="whatsapp" | "direct" | "pos"`).
- ~~**M15 (loyalty):** passport panel placeholder, homepage band defaults~~ — done in M15 (T82–T89).
- **M15 → M12 (POS):** sales through `settle_if_paid` earn stamps automatically. To redeem at the till call
  `loyalty_redeem_reward(reward_id, variant_id, p_order_id => <open POS order>)` (allowed with `pos.use`);
  available rewards: `loyalty_rewards` where `status = 'available'`. Any redefinition of `after_order_paid` /
  `after_order_cancelled` must keep the loyalty calls.
- **M15 TODO — online reward redemption at checkout**: offer a signed-in passport holder's available reward as a
  zero-priced line in checkout. Needs: passing `reward_id` + variant to `create_web_order` (customer must match
  the passport), a hold on the reward while the order is `pending_payment` (released for abandoned checkouts),
  and marking it redeemed in `after_order_paid`. Until then the passport page says "redeem at a pop-up / on
  WhatsApp".
- **M17 (loyalty):** scheduled stamp expiry (only matters if the owner turns expiry on — T89); rate-limit the
  passport magic-link form.
- **M17 (hardening):** Lighthouse mobile on `/` measured locally at perf 90–91, a11y 100, best-practices 96
  (404 prefetches of not-yet-built routes), SEO 100. Re-check with real client photography.
