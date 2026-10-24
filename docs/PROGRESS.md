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

## Phase 2 (branch `phase-2`)
Work happens only on `phase-2` (never merged/pushed to main; no PR). DB changes are applied to **local
Supabase only** (Colima + `pnpm db:start`; `.env.development.local` points the app and e2e at it — see
DECISIONS P2-3). Local owner login: `owner@solei.test` / `Solei-dev-2026` (re-enrol TOTP on /admin/mfa
after a `db:reset`).

| # | Feature | Status |
|---|---|---|
| 1 | Promotions / discount engine | ✅ built (`20261024000001/2_promotions*.sql`) |
| 2 | Gift cards | ✅ built (`20261024000003–5_gift_card*.sql`) |
| 3 | Abandoned cart | ✅ built (`20261024000006_abandoned_carts.sql`) |
| 4 | CRM segments & campaigns | ⬜ |
| 5 | Points & VIP tiers + birthday offer | ⬜ |
| 6 | Giveaways customiser | ⬜ |
| 7 | WhatsApp API · courier API · staff attendance · PDF reports (mock providers) | ⬜ |

**1 — Promotions:** Admin → Promotions (`/admin/promotions`): % off / AED off / free delivery, minimum
order, start/end dates, total uses, uses per customer, category + product scope, pause/delete. Checkout
applies the code server-side (summary shows the discount, or the waived delivery struck through); the order
stores `discount_fils`, `delivery_discount_fils`, `coupon_code` and `applied_promotions`. Admin → Reports →
Promotions shows orders / discount / delivery waived / sales per code. Tests: `coupons/schema.test.ts`,
`orders/pricing.test.ts`, pgTAP `120_promotions_test.sql`, e2e `e2e/promotions.spec.ts` (all 3 viewports).
The e2e helpers were patched for the current login form (exact "Password" label) and dashboard heading
("Hello, …").

**2 — Gift cards:** `/gift-cards` (store menu + footer): owner-set amounts, for me / for someone else,
message, live card preview; signed-in buyers pay on the hosted page; when the webhook confirms it the card goes
live (code `XXXX-XXXX-XXXX`, expiry from Settings) and is emailed (`gift_card_delivered` to the recipient,
`gift_card_purchased` receipt to the buyer). Spend: checkout "Gift card" box (signed-in) after the discount
code — covers what it can, the rest goes to the card page, or "Place order" when it covers everything; the
till has a Gift card button (checked online) with the rest by any method. Admin → Gift cards: figures, search,
card page with balance history, resend / adjust / void, Issue gift card, Settings (sell online on/off, amounts,
months valid, accept at the till). Refunds to "Gift card" (order page) and cancellations credit the card;
unpaid checkouts give the held balance back after 24 h. Tests: `gift-cards/schema.test.ts`, pgTAP
`130_gift_cards_test.sql` (28), e2e `e2e/gift-cards.spec.ts` (3 viewports).

**3 — Abandoned carts:** signed-in customers' bags are mirrored to `carts` (and brought back on another device
with an empty bag). A bag left untouched gets a "Bag reminder" email after the owner's delay (default 4 h) and
optionally a second (default 48 h) — never more than two, only within 30 days, never to opted-out or
unsubscribed customers. The email links "Return to your bag" (`/cart/restore`, puts the bag back and opens
checkout) and "Turn them off" (`/cart/stop`, a button page). Account → Emails switches reminders on/off. A paid
order closes the bag ("Recovered" when a reminder had gone out). Admin → Abandoned carts: figures, In bags now /
Recovered / All, Reminders settings (on/off, hours), "Send due reminders now". Automatic sending needs a
scheduler calling `GET /api/cron/cart-reminders` with `Authorization: Bearer $CRON_SECRET` (see DECISIONS
P2-9). Tests: `carts/carts.test.ts`, pgTAP `140_abandoned_carts_test.sql`, e2e `e2e/abandoned-carts.spec.ts`.

**Left for the hardening pass (M17):**
- pgTAP `070_orders_admin`, `080_bookings`, `110_reports` fail on stale expectations from later Phase 1
  changes (template count 16 vs 14, `record_payment` rules, report permissions) — not Phase 2 regressions.
- Orders Excel/CSV export: add a promotion code / delivery-waived column (needs the export RPC rewritten).
- Rate-limit gift card lookups at checkout (signed-in only today; 32^12 codes) and on the till.
- The desk preview browser (WebKit, background tab) doesn't reveal streamed admin pages until it is focused
  (React batches Suspense reveals on `requestAnimationFrame`); real browsers and Playwright are fine.

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

## Handoff — 2026-10-16 (start the next session here)
**Working style now:** commit straight to local `main` (small commits; no branches/PRs). Push + deploy only when
the user says "deploy" — `git push origin main` (Vercel auto-deploys; no `ship.sh`/PR). Another agent may work in
this checkout: stage/commit only your own paths (Sikemux blocks `git add -A`). Kill local servers when done.
Dev CSS goes stale sometimes → stop dev, `rm -rf .next`, restart. Local preview browser uses `localhost:3000`
(`127.0.0.1` is allowed in `next.config.ts` too).

**Live (deployed) since the 10-15 handoff:** Our story (client wording, `/story`), Contact us (`/contact`, pink,
WhatsApp 050 470 8053 · soleiperfumes@gmail.com · @solei.ad from Admin → Settings → Contact details), Help centre
(`/help`, policies in DB table `help_topics`, editable in Admin → Settings → Help & policies; `/policies/*`
redirect), Destinations pages removed (redirect to `/shop`), footer "Website by CityReach", no address anywhere,
no VAT (rate 0, lines hidden), AED 30 flat UAE delivery, password eye toggles + confirm password, admin login
slideshow, admin collapsible sidebar + burgundy/baby-pink admin theme, performance pass (no inlined CSS, logo
sprite, DB-side stats RPCs, parallel queries, debounced cart), Ziina provider code (inactive until API key),
test sign-up code `ACCOUNT_TEST_CODE=123456` (until Resend).

**Deployed 2026-10-16 (later):** the redesigned **Solei Passport page** (`src/app/(store)/passport/page.tsx`,
copy in `src/content/en.ts` → `passport`), built to the client's mock-up: hero "Every scent takes you somewhere."
as a clean split like Contact us (copy on cream; the collection photo p10 `passport-collection.jpg` in an arch
beside it on laptop, below it on phones; no fade) → "Your journey in 3 simple steps" on blush → burgundy band with
the live 12-sticker tracker (signed out: "Sign in to view progress" opens the sign-in drawer —
`src/components/store/passport/passport-sign-in.tsx`) → FAQ. Approved by the user. The client's 10 studio photos
are in `~/.solei-tools/scratch/passport-src/p1–p10.jpg` (originals in `~/Downloads/WhatsApp Image 2026-10-16 at
19.59.*.jpeg`); in the repo: p2 `passport-hero.jpg` (steps), p8 `passport-cards.jpg` (tracker), p10 (hero).

**Domain, email, ownership (done 2026-10-17):** site lives at **https://soleiperfumes.com** (bought at
tasjeel.ae, account "reem alnaqbi" / soleiperfumes@gmail.com; DNS in tasjeel's DNS Manager: apex A → Vercel
216.198.79.1 + 64.29.17.1, www CNAME → Vercel, Resend DKIM/`send`/`rsend`/DMARC; tasjeel MX left as is).
Real email on: Resend team "soleiwebsite26" (Admins: soleiperfumes@gmail.com + rajputsujal098@gmail.com),
domain verified (eu-west-1), sending key "Solei website (Vercel)" (Keychain `solei-resend-api-key`), Vercel
`RESEND_API_KEY` + `EMAIL_FROM="Solei <hello@soleiperfumes.com>"`, `NEXT_PUBLIC_SITE_URL=https://soleiperfumes.com`;
`ACCOUNT_TEST_CODE` deleted on Vercel. Supabase org "Solei": Owners soleiperfumes@gmail.com + you; Auth Site URL
= soleiperfumes.com (+ redirect entries). ⏳ First real email not yet tested end-to-end. Supabase free-project
limit counts orgs where you're Owner/Admin — client upgrading Solei to Pro at launch frees your slot.

**Still needed from the client (not blocking):** Ziina API key (`PAYMENT_PROVIDER=ziina`, `ZIINA_API_KEY`, then `pnpm ziina:webhook https://<site>`), dark product
photography (later), optional delivery-time / refund-timeline / passport reward rules, Dukhoon products?

**Before launch (ours):** separate production Supabase project, re-enable 2FA for owner/manager, remove
`ACCOUNT_TEST_CODE` from local `.env.local` + delete test accounts, re-enable CI and run e2e (M17 hardening). Architecture notes and
next steps (account_user_id column on orders, stored stock balances) are in DECISIONS / this file.

## Carry-overs
- **Ziina payments (client's gateway):** code is ready (`src/providers/payment/ziina.ts`). To go live, set on
  Vercel `PAYMENT_PROVIDER=ziina`, `ZIINA_API_KEY=…` (token with `write_payment_intents`; `ZIINA_TEST_MODE=1`
  first for test payments), then run once `ZIINA_API_KEY=… pnpm ziina:webhook https://<site>`. Until then the
  site keeps the mock test checkout.
- ~~**Account test code:**~~ off on the live site since 2026-10-17 (Resend on, variable deleted on Vercel).
- **Contact details (client 2026-10-16):** WhatsApp 050 470 8053, support + owner-alert email
  soleiperfumes@gmail.com, Instagram @solei.ad — in Admin → Settings → Contact details and in the
  Shipping/Privacy policies (migration `20261016000002_contact_details.sql`).
- **Resend (account codes + notifications):** live since 2026-10-17 (see "Domain, email, ownership"). Outside
  production only `EMAIL_ALLOWLIST` recipients get real email (empty locally → local codes are not delivered).
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
