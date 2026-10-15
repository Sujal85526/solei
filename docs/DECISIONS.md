# Decisions & open questions

Open client questions are built as configurable defaults. Each row: what we chose, why, and where to change it.

| # | Topic | Default chosen | Status | Where configurable |
|---|---|---|---|---|
| D1 | VAT | 5%, prices **inclusive**; stored as basis points (500) | ❓ confirm TRN / registration | `settings.vat_rate`, `settings.prices_include_vat` |
| D2 | Language | English only, RTL-ready (logical CSS, copy dictionary) | ✅ client 2026-10-15: no Arabic | — |
| D3 | Delivery zones/fees | AED 30 flat, UAE only, no free-delivery threshold | ✅ client 2026-10-15 (handover §04) | `delivery_zones`, `settings` (admin) |
| D4 | Refund / return policy | Handover §04 wording (7 days, unopened) on the Help page | ✅ client 2026-10-15 | Admin → Settings → Help & policies |
| D5 | Customer accounts | Guest checkout + magic-link passport page | ❓ confirm | — |
| D6 | Perfume vs spray split | Perfumes: Cannes, Marbella, Verona, Capri, Santorini; sprays: Soho, Monaco, Mayfair (inferred from profile) | ❓ confirm | product catalog |
| D7 | Dukhoon products | Category exists, no products seeded | ❓ client to list | product catalog |
| D8 | Booking deposit | 50% | ❓ confirm | settings / per quote |
| D9 | Booth availability limits | Overlap **warning**, no hard block | ❓ confirm | — |
| D10 | Package prices | Placeholder prices | ❓ client to supply | booking packages admin |
| D11 | Brand font "Nove" | Keep the web substitutes (Cormorant Garamond + Jost) | ✅ client 2026-10-15: use current | `src/app/fonts.ts` |
| D12 | Payment gateway | Ziina (client 2026-10-15) behind `PaymentProvider`; Stripe/mock remain for tests | ⏳ Ziina API key | `src/providers/payment` |

## Technical decisions
- **T1 — Next.js 16 (App Router) with `cacheComponents`** as scaffolded by `create-next-app`; local docs in
  `node_modules/next/dist/docs` are the reference (APIs differ from older versions, e.g. `proxy.ts` replaces middleware).
- **T2 — shadcn/ui `base-nova` style (Base UI primitives)** with `rtl: true` so generated components use logical classes.
- **T3 — Money as integer fils, rates as basis points**; inclusive-VAT extraction rounds half-up per amount.
- **T4 — Phones stored E.164**; local UAE formats normalised; foreign numbers need `+`/`00`.
- **T5 — Supabase new API keys** (`sb_publishable_…` / `sb_secret_…`) instead of legacy anon/service-role JWTs.

## Design system (milestone 1)
- **T6 — Palette** (`src/lib/brand/palette.ts`, contrast-tested in `palette.test.ts`): burgundy `#460328` and
  pink `#F7CDD0` (client); cream paper `#F6EEE8`, sand `#EFE3DA`, gold `#B08D57` (hairlines only), gold-ink
  `#7A5A2B` (small gold text, 5.5:1), ink `#24030F`, ink-muted `#6A4655`. Pink is never used as text on cream (1.3:1).
- **T7 — Fonts**: Bodoni Moda (display, stand-in for "Nove") + Inter (UI) via `src/app/fonts.ts` — swap the
  real font there only.
- **T8 — Logo**: traced to vector from `ref-3.jpeg` with potrace → `src/components/brand/logo.tsx` (currentColor).
  ❓ Replace with the designer's original SVG when supplied.
- **T9 — Imagery**: photos in `public/images/**` are cropped from the company-profile PDF pages (≈ 1000px max,
  destination cards ≈ 200px source, upscaled). 🔁 **Replace with client photography** (originals) before launch.
  Per-product images are **3D renders** in `public/images/renders/product-<slug>-<perfume|spray>.jpg` (+ `.webp`,
  1600×1600 on cream), generated reproducibly by `scripts/blender/` (Blender 5.2 + Cycles; see its README) and
  seeded as each product's first image (`productImage` in `src/modules/content/seed.ts`). They are product
  _visualisations_ modelled on the real bottles — placeholders until the client uploads real product photos via
  admin. Hero/lifestyle imagery comes from the client's own supplied images, not these renders.
- **T10 — Admin theme**: same palette on brighter surfaces (`.theme-admin`), burgundy sidebar on desktop,
  bottom nav (4 primary + More) on phone/iPad portrait.

## Homepage (milestone 2)
- **T11 — Destination copy**: region + mood + story lines per destination are placeholder copy written from the
  postcard imagery (`src/modules/content/seed.ts`). ❓ Client to confirm or supply scent notes.
- **T12 — Hero**: split layout (burgundy copy panel + photo) instead of full-bleed text-on-photo, because the
  available photography is ~1100px wide; switch to full-bleed when high-res client photography arrives.
- **T13 — Opt-in form** is a native form + server action (no client form library) to keep the homepage
  bundle small; consent checkbox is required and unticked by default.

## Core schema (milestone 3)
- **T14 — Costs are separate tables** (`variant_costs`, `order_line_costs`) readable only with
  `reports.financial.view`, because Postgres RLS is row-level, not column-level.
- **T15 — MFA in the database**: `has_permission()` ignores the permissions of roles with `requires_mfa`
  (owner, manager) unless the session JWT is `aal2`.
- **T16 — Audit**: a generic trigger logs every insert/update/delete on business tables (actor, before/after,
  IP); RPCs add semantic entries (`stock.transfer`, `order.cancel`…). The log is append-only.
- **T17 — Order status** adds `pending_payment` (website orders before the webhook confirms payment) to the
  brief's list; payment status (`pending | partially_paid | paid | refunded`) is derived in `order_payment_summary`.
- **D13 — Perfume size** assumed **50 ml** (sprays 100 ml per profile). ❓ confirm.
- **D14 — Demo unit costs** perfume AED 90, spray AED 55 (seed only). ❓ client to supply.
- **D3 (update) — Delivery fees** default AD 20 / Dubai, Sharjah, Ajman 25 / UAQ, RAK, Fujairah 30 AED;
  free delivery from AED 500. ❓ confirm.

## Admin auth (milestone 4)
- **T18 — Staff accounts are invite-only** (Supabase invite email → `/auth/confirm` → set password). Public
  sign-up stays enabled only for the customer passport magic link later; it grants no admin access because
  access requires a `staff_profiles` row.
- **T19 — Deactivation** sets `staff_profiles.active = false` (permissions vanish on the next query) **and** bans
  the auth user so the session can't be refreshed.
- **T20 — Guards**: owner can't change their own role or deactivate themselves; the last active owner can't be
  demoted/deactivated; the owner role always has every permission.
- **T21 — Login attempts** (success/failure, MFA failures, resets, logouts) are written to `audit_log` with IP.
- **T22 — GoTrue revokes a user's other aal1 sessions after a successful MFA verify.** Expected security
  behaviour; e2e tests therefore create a dedicated owner per test.

## Catalog & inventory admin (milestone 5)
- **T28 — Product photos upload directly from the browser to Supabase Storage** (`products/<productId>/…`,
  RLS `catalog.manage`, 5 MB, JPG/PNG/WebP/AVIF), then a server action records the row — avoids server-action
  body limits. The first image is the cover; alt text is editable.
- **T29 — Variants with stock or sales history can't be deleted** (ledger integrity) — deactivate instead.
- **T30 — Adjustments**: damage (−) and count corrections (±) always need a reason; transfers lock the source
  variant row and refuse to go negative; event locations are managed by events, not here.
- **T31 — Admin forms keep their values after errors** (`useFormAction`): React 19 resets `<form action>`
  forms after every submit; we dispatch inside a transition instead, while keeping the server-action POST as
  the pre-hydration fallback (never a GET with field values in the URL).

## Storefront shop & cart (milestone 6)
- **T23 — Cart lives in the browser** (`localStorage` key `solei.cart.v1`, read with `useSyncExternalStore`, no
  provider; syncs across tabs). It stores only `{ variantId, qty }` lines plus the emirate chosen for the delivery
  estimate. Names, prices, availability and totals always come from the server action `getCartDetails`, which
  clamps lines to live online stock and drops sold-out / withdrawn variants with a notice. Server-side carts (for
  abandoned-cart in Phase 2) can replace the storage adapter without touching the UI.
- **T24 — Pricing** is one pure function (`src/modules/orders/pricing.ts`) shared by cart, checkout and POS. VAT is
  computed once on goods + delivery (delivery is VAT-able), rounded half-up; inclusive or exclusive per
  `settings.prices_include_vat`. Free delivery when the goods subtotal ≥ `free_delivery_threshold_fils`; reward
  lines are free and don't count towards the threshold.
- **T25 — Caching**: catalog reads are `"use cache"` (`cacheLife("hours")`, tag `catalog`; settings/zones tag
  `settings`). Display availability is a separate cache (`cacheLife("minutes")`, tag `stock`) — stock-changing
  code should `revalidateTag("stock")`. The cart action reads availability live (uncached) so it never
  oversells. Slug pages use `ensureStatic = "navigation"`: known slugs are prerendered and unknown slugs return a
  real 404 instead of a streamed 200 shell.
- **T26 — Public stock counts are not shown**; the product page only disables "Add to cart" (Sold out / all
  available units already in the cart) and caps the quantity stepper at what is available.
- **T27 — Product gallery** uses whatever `product_images` the admin uploads (first image leads). Seeded images
  are low-resolution profile crops (see T9) and look soft at gallery size until client photography arrives.
- `next.config.ts` allows `next/image` to load from the Supabase Storage public bucket (admin uploads).

## Checkout & payments (milestone 7)
- **T32 — Payment flow**: `create_web_order` (status `pending_payment`, prices re-checked in SQL, cost
  snapshots) → hosted checkout → **verified webhook** → `confirm_payment` (row-locked, idempotent) →
  `after_order_paid` (stock deduction once; loyalty extends it). Webhook deliveries are deduplicated in
  `payment_events` by provider event id; processing failures return 5xx so the provider retries.
- **T33 — Mock provider** (`PAYMENT_PROVIDER=mock`, default without Stripe keys): `/pay/mock/[ref]` approves or
  declines and sends an HMAC-signed webhook through the same endpoint as Stripe. Refused in production builds
  unless `ALLOW_MOCK_PAYMENTS=1` (CI only). ❓ Stripe **test** keys needed from the client's Stripe account.
- **T34 — Stock is deducted on payment, not at order creation** (abandoned checkouts don't hold stock).
  Availability is re-checked at checkout; a rare race between two simultaneous final units can oversell —
  visible as negative stock in admin.
- **T35 — Guest order links** are `/order/<number>?t=<HMAC>`; tracking without the link needs number + phone.

## Hosted Supabase (dev)
- **T38 — Dev database is hosted**: Supabase project `solei` (ref `ljjpyjzkbexucaqmxbas`) in a separate
  **"Solei" organisation** (transferable to the client), region **ap-south-1 Mumbai** — the closest Supabase
  region to the UAE (~30–40 ms; there is no Gulf region). Local Docker Supabase is no longer required for
  development; CI still runs an ephemeral local Supabase for pgTAP + e2e.
- Hosted DB has the catalogue seed only (`pnpm exec tsx scripts/generate-seed.ts --catalog-only <file>`),
  **never** the dev logins (their passwords/TOTP secret are public in the repo).
- **T39 — Email links**: free-tier projects can't customise auth email templates without custom SMTP, so invites
  and password resets redirect to `/auth/callback`, which handles Supabase's default links (implicit `#tokens`
  and PKCE `?code`). The branded templates (`/auth/confirm` + token_hash) apply once Resend SMTP is configured.

## Editorial redesign (client direction, 2026-10-14)
- **T46 — Storefront is a dark, cinematic editorial theme** (client references): noir `#170510` / wine `#2A0A16`
  base, blush-pink panels (`.on-blush`), pink headlines, pearl body text; scoped with `.theme-store` so the admin
  keeps its bright working surfaces. Buttons use semantic `primary` (burgundy in admin, pink in store).
  Contrast pairs added to `palette.test.ts`.
- **T47 — Type**: Cormorant Garamond (light display, still a stand-in for "Nove") + Jost (letter-spaced labels,
  navigation, body, admin). Change in `src/app/fonts.ts` only.
- **T48 — Homepage**: hero slider (3 slides, pause/arrows/progress, Ken Burns, reduced-motion aware) →
  "Signature Scents." product rail from the database with quick add → "Our story" blush split → "Different
  places. Same feeling." band + destinations index → Plan your event → Passport → "More than a fragrance."
  early-access sign-up. Slide copy/images in `src/content/home.ts`; photography from
  `public/images/editorial/` (client originals) with brand fallbacks until delivered.
- **T49 — Product images** come from the database (admin uploads); Blender renders are the default covers.

## Event calendar (milestone 11)
- **T40 — Overlap is a warning, never a block** (D9): `overlapping_events()` returns other non-cancelled events
  whose inclusive date ranges intersect (an event ending the day another starts counts) and flags the same venue
  (case/space-insensitive). Shown live on the create/edit form and on the event overview.
- **T41 — Daily hours** are stored per business day in `events.daily_hours` (`{ "YYYY-MM-DD": { open, close } }`);
  the form generates one row per day and offers "same hours every day". Closing after midnight is allowed.
  Events are capped at 62 days. Weeks start on Monday.
- **T42 — Expenses are financial**: `event_expenses` and receipts (`event-docs/<event>/receipts/…`) need
  `reports.financial.view` to read or write; documents (`event-docs/<event>/docs/…`) follow `events.view` /
  `events.manage`. The bucket is private; downloads use 1-hour signed URLs. The participation fee amount is
  hidden in the UI without `reports.financial.view` (row-level RLS can't hide a column).
- **T43 — Staff names for events** come from `event_staff_options()` (security definer, `events.view`), because
  `staff_profiles` is readable only with `staff.manage`.
- **T44 — Stock**: allocation is one transaction (`allocate_event_stock`, main → event location). Close-out
  (`close_event_stock`) requires returned + broken = remaining for every product, so the event location ends at
  zero; breakage is a `damage` movement with a reason (default "Broken at event"). Closing sets `closed_at` and
  status → completed; `reopen_event()` exists for mistakes (ledger moves stay). Per-event numbers come from the
  view `event_stock_summary` (allocated / net sold / returned / damaged / other / remaining). Closing needs
  `events.manage` + `inventory.transfer` (not `inventory.adjust` — breakage is part of the close-out).
- **T45 — Calendar default view** is automatic: list on phones, month on tablet/desktop; `?view=` pins one.
  Status drives colour (potential dashed, confirmed burgundy, completed sage, cancelled struck grey); type drives
  the icon; private bookings get a gold edge so customer bookings (M14) stand out.

## Orders admin & notifications (milestone 8)
- **T50 — Orders change only through RPCs** (`update_order_status`, `record_payment`, `record_refund`,
  `cancel_order`, `update_order_notes`): each checks the permission, locks the order row and writes an audit
  entry. The direct `orders` update policy was dropped so status rules can't be bypassed. Allowed manual moves
  live in `order_status_allowed()` (mirrored and drift-tested in `src/modules/orders/status.ts`); `pending_payment
  → new` only happens on full payment, cancelling is its own action.
- **T51 — Manual payments** accept cash / card terminal / soft POS / bank transfer / other only (online methods
  come from verified webhooks), never more than the outstanding balance. A payment that completes an order
  awaiting payment confirms it, deducts stock once and cancels stale online attempts.
- **T52 — Refunds are records of money already returned** (cash, transfer, or a refund done in the provider
  dashboard) — at most paid − refunded, reason required. Cancelling is separate: it returns deducted stock to
  the location it left from once (toggle off for lost/damaged goods), cancels pending online payments and calls
  `after_order_cancelled()` (loyalty reversal later). Sales staff can record payments but not refund/cancel.
- **T53 — Notifications** (`src/modules/notifications`): owner-editable templates (light markdown +
  `{{variables}}`; variable values are escaped and never parsed as markdown) → allowlist guard → provider →
  `notification_log` (sent / failed / skipped + reason). A send never throws into the caller and runs after
  the response (`after()`), so a slow email provider can't delay a webhook. Without `RESEND_API_KEY` emails are
  logged (provider `log`) and visible in Admin → Settings → Notifications → Outbox. Outside production only
  `EMAIL_ALLOWLIST` recipients get real email (`EMAIL_ALLOW_ALL=1` on the live site).
- **T54 — Which emails fire**: paid order → customer confirmation + owner "new order" (not for POS sales) +
  low-stock check; preparing / dispatched (with courier + tracking) / delivered → customer; online payment
  failed/expired → retry link (only while the order still awaits payment); a recorded payment that doesn't
  complete the order → "payment received". Owner alerts go to `private_settings.owner_notification_email`
  (editable on the notifications page; empty = off). ❓ Client to confirm the owner alert address.
- **T55 — Low-stock alerts**: after paid orders and after damage / correction / transfer actions, variants at or
  below their alert level (warehouse stock, excluding event locations — same as the stock screen) email the
  owner, at most once per SKU per 24 h (`notification_log.dedupe_key`).
- **T56 — Order list default** hides abandoned website checkouts (`pending_payment`); choose "All" or search
  by number / name / phone to find them. "Outstanding" sums balances of open (non-cancelled, confirmed) orders.

## Customers CRM (milestone 10)
- **T57 — `customer_summary` view** (`security_invoker`) gives one row per customer with `order_count`,
  `total_spent_fils`, `first_purchase_at`, `last_purchase_at` — one query for the list (search, filters, sort,
  pagination) and the CSV export. A **purchase** is any order that is not `pending_payment` (abandoned web
  checkout) or `cancelled`; **total spent** is money actually received: succeeded payments − succeeded refunds
  over all the customer's orders (partial payments count for what was paid). Because the caller's RLS applies,
  totals and order history need `orders.view` as well as `customers.view` (every launch role with one has the
  other); the UI hides the stats instead of showing zeros when it's missing. Totals are revenue, not cost, so
  they don't need `reports.financial.view`.
- **T58 — Search**: phone-looking input is normalised like checkout (`050 123 4567`, `+971 50…`, `00971…` →
  `+971501234567`) and matched on the digits; a partial local number drops its trunk `0` (`0501` → `501`).
  Other input matches name or email (`ilike`, trigram indexes); PostgREST filter characters are stripped.
- **T59 — `CustomerPicker`** (`src/components/admin/customers/customer-picker.tsx`, reused by manual orders and
  POS): `onSelect(customer)`, optional `source` for customers it creates, `canCreate`. ARIA combobox (↑/↓, Enter,
  Esc), 250 ms debounced server-action search, inline quick-create. It renders **no `<form>`** so it can live
  inside another form. Quick-create dedupes like `upsert_customer`: an existing phone (or email when no phone)
  returns that customer instead of a duplicate.
- **T60 — Consent**: staff can record consent (channels + timestamp) or an opt-out (`marketing_consent = false`,
  channels cleared, `unsubscribed_at = now()`; the original consent time is kept for history). The CSV export
  always includes consent, channels, consent time and unsubscribe time so marketing sends can filter on them;
  cells are written formula-safe (`=`, `@`, `+`/`-` text prefixed with `'`; phone numbers left intact).
- The Passport panel on the profile is a placeholder ("Passport launches soon") until milestone 15.

## Event booking (milestone 14)
- **T61 — Booking options are database rows** (`booking_event_types`, `booking_service_types`, `booking_packages`,
  `booth_designs`, `flower_options`) edited in Admin → Bookings → Packages & options. Options used by bookings
  can't be deleted (FK restrict) — hide them instead. Flower price = `settings.booking_flower_base_fils` + the
  colour's surcharge.
- **D15 — Launch package prices are placeholders** ❓: Essence AED 3,500, Signature AED 6,500, Grand Destination
  AED 12,000; flowers AED 800 base (+0 blush/ivory, +150 burgundy, +250 gold, +300 mixed); quotes valid 14 days;
  deposit 50% (D8). Inclusions and booth names are placeholder copy; photos reuse the profile crops in
  `public/images/events` until client photography arrives.
- **T62 — The estimate is computed in Postgres** (`booking_estimate`, used by `submit_booking` and the summary
  preview): package base + flowers + products of interest × the category's lowest active price. Categories
  without a price (dukhoon) are listed "priced in your quotation". `src/modules/bookings/estimate.ts` mirrors it
  for the wizard's running total; client prices are never stored.
- **T63 — Public submit/accept are SECURITY DEFINER RPCs** granted to `anon` (`submit_booking`, `accept_quote`,
  `get_booking_quote`, `quote_payment_order`); submit is idempotent by a client UUID kept in the local draft.
  Quote links carry a 64-hex random token per version (`/events/quote/<token>`).
- **T64 — Quotes are versioned; every send is a new version** and supersedes older open ones (their links then
  say "replaced"). Re-quoting is allowed until the booking is confirmed. Quote amounts are VAT-inclusive.
- **T65 — Deposits/balances are orders** (`channel = 'booking'`, `booking_id`, no lines) paid through the normal
  hosted checkout → webhook → `confirm_payment`. Trigger `booking_order_paid` logs the payment on the booking,
  treats payment as acceptance of the current quote, confirms the booking (creating the `private_booking`
  calendar event, linked both ways) and closes the order as `completed`. Offline payments recorded on the order
  take the same path; staff can also "Confirm manually". A quote with a 0 deposit confirms on accept. The generic
  order-confirmation email is skipped for booking orders; `booking_confirmed` is sent instead.
- **T66 — Admin payment links** create the booking order + a provider checkout session, recorded in
  `payment_links`. Customers can also pay from the quote page (a fresh session each time, so no expiry issue).
- **T67 — WhatsApp is click-to-chat** (`wa.me` + prefilled text); "Open WhatsApp" in the messages panel is
  logged in `booking_messages`. Free-form emails use the new `booking_message` template.
- **T68 — Wizard draft** lives in `localStorage` (`solei.booking.draft.v1`) with the current step; cleared after
  submit. The homepage occasions band still uses the seed list (`seedEventTypes`) — switch it to
  `booking_event_types` when the homepage is next touched. Submissions are not rate-limited yet (M17).

## Manual orders & payment links (milestone 9)
- **T69 — One "fully paid" path**: `orders.paid_at` + `settle_if_paid()` is called by the webhook
  (`confirm_payment`), manual payments (`record_payment`) and manual orders, so `after_order_paid` (stock for
  website orders; loyalty next) runs exactly once whichever way an order is paid.
- **T70 — Manual orders deduct stock at creation** (staff-confirmed sale) from the online/default location;
  payment may be now, partial or later. Price overrides need `orders.price_override` + a reason (DB-enforced).
- **T71 — Payment links** are hosted checkout sessions for any amount ≤ outstanding; each is a pending payment
  + a `payment_links` row; the webhook marks both paid. WhatsApp sharing uses wa.me with a prefilled message.
- **T72 — Outstanding** = confirmed orders (not cancelled, not abandoned website checkouts) with a balance;
  reminders create a fresh link, email it if possible and open WhatsApp.
- Dev hosted project has a **bot owner** (`dev-bot@solei.test`) for automated checks; its password/TOTP live in
  the macOS Keychain (`solei-dev-bot-password`, `solei-dev-bot-totp`), never in the repo.

## Event reports (milestone 13)
- **T73 — Facts in SQL, rules in one TS module**: `event_report_data(event_ids[])` (SECURITY DEFINER,
  `reports.view`) returns per-event facts — orders with status, lines with snapshots, succeeded payments/refunds,
  stock movements per Asia/Dubai day × variant × type, expenses. `src/modules/reports/aggregate.ts` rolls them up
  for the page, the comparison and the exports, so every view applies the same rules (unit-tested).
- **T74 — Financial gating in the database**: cost snapshots, expenses and the participation fee come back as
  null/empty unless the caller has `reports.financial.view` (with MFA for owner/manager); the UI and the
  Excel/CSV exports simply omit those columns then.
- **T75 — Report rules**: counted orders exclude `cancelled` and `pending_payment`; business day = POS
  `event_day`, else `placed_at` in Asia/Dubai; revenue = order totals − refunds (incl. VAT; refunds land on the
  order's day); profit and margins are **ex VAT** (VAT pro-rated after refunds); COGS = Σ qty × line cost
  snapshot (missing snapshots count as 0 and are flagged); expenses + fee are event-level, so net profit appears
  only under "All days"; a waived fee counts as 0. Product/destination/category "sales" are line totals.
- **T76 — Stock per day**: movements before the first day (allocation) or after the last (close-out) are shown on
  the edge day; a day tab shows that day's movements and the closing on-hand that evening.
- **T77 — Comparison** normalises by the scheduled event days (start → end) and picks 2–6 events
  (`?ids=a,b` or repeated `ids`); charts are one measure each (no dual axes), burgundy single-series bars next to
  tables with the same numbers.
- **T78 — Exports**: Excel (exceljs) with a burgundy brand header, AED / % / date number formats, a summary,
  breakdown sheets and one sheet per event day; CSV is a tidy one-row-per-day × product table (compare: one row
  per event). Both are permission-aware route handlers under `/admin/reports/events/…/export`.

## Event POS (milestone 12)
- **T79 — One idempotent RPC per sale** (`pos_complete_sale`, keyed by the device's client UUID): catalogue
  prices, payments must equal the total (split allowed), stock leaves the event's own location (may go negative —
  a booth sale is never blocked; close-out reconciles), `event_day` is the Asia/Dubai date of when the sale
  happened on the device (offline sales land on the right day), order status `completed`, then `settle_if_paid`.
- **T80 — Offline**: every sale is written to IndexedDB before sending; the queue replays on reconnect / every
  30 s; rejected sales stay visible until dismissed. A service worker (registered only from the POS page) caches
  the POS page + static assets so it reopens offline; the app is installable (manifest, apple-touch icon).
- **T81 — Tap count**: tile, tile, Charge, Cash = 4 taps for a 2-perfume cash sale; customer phone is optional
  on the payment sheet (creates/links the customer for passport stamps).
## Solei Passport (milestone 15)
- **T82 — Versioned rules, one programme row**: `loyalty_programs` (id 1, on/off) + `loyalty_rule_versions`
  (stamps per item, qualifying categories/products — both empty = everything, threshold, reward type + config +
  customer-facing label, passport after N purchases or null = on request only, reward items earn?, expiry
  months). Saving settings with any rule change inserts a new version effective now (`loyalty_save_rules`,
  `loyalty.manage`); stamps keep the `rule_version_id` they were earned under. Launch rule seeded as version 1
  (1 per item, 12 → "a free all-over spray of your choice", passport after 2, rewards don't earn, no expiry).
  The reward category is stored by id, or by slug when the catalogue is seeded after migrations (local/CI).
- **T83 — Balance = Σ ledger = progress on the current card**. Kinds: `earned` (+, one row per qualifying order
  line: qty × stamps per item, line destination), `manual` (±, reason, `loyalty.adjust`), `reversed` (−, undoes
  one earned row once), `redeemed` (−threshold when a card completes and a reward unlocks; +cost when an unused
  reward is withdrawn), `expired`. Settling (`loyalty_settle`) unlocks one reward per full card — several when
  one order crosses several thresholds — and carries the remainder (11 + 3 → 1 reward, 2 left). Rewards snapshot
  the rule (cost, type, config, label). `src/modules/loyalty/engine.ts` mirrors the SQL and is unit-tested.
- **T84 — Award on paid, reverse on cancel / full refund**: `after_order_paid` (stock, then loyalty) and
  `after_order_cancelled` now award/reverse; a trigger on refund payments reverses the stamps when the order's
  payment status becomes `refunded`. **Partial refunds keep the stamps** (no item-level refund data yet).
  Stamps need an order customer and the programme on; awarding is idempotent per line. Loyalty failures never
  block a payment or cancellation: they are caught and logged to `audit_log` (`loyalty.award_failed`).
  If stamps are taken back after their reward was already redeemed the card goes negative ("owed") and later
  stamps fill it; an unused reward is withdrawn instead. Cancelling a reward order gives the reward back.
- **T85 — Passport**: auto-issued (`passports.how = auto`) once the customer has N paid purchases (orders with at
  least one non-reward line); staff can issue on request. Stamps accrue from the first purchase regardless.
  Numbers are `SP-0xxxx`.
- **T86 — Redemption** (`loyalty_redeem_reward`, `loyalty.adjust` or `pos.use`): item rewards add a zero-priced
  `is_reward` line — on a new `direct` order (total 0, settles as paid at once, `reward_redemption` stock
  movement) or on an existing open order of the same customer (POS can pass its order). Value rewards (fixed
  AED / %) are only *marked used* on an order; applying the discount waits for the promotions engine (Phase 2).
  ❓ **Online redemption at checkout is not built yet** — the passport page tells customers to redeem at a
  pop-up or on WhatsApp (needs a reward hold on pending website orders; see PROGRESS).
- **T87 — Customer passport login**: `/passport` sends a Supabase magic link (`/auth/callback?next=/passport`)
  only when the email belongs to a customer (same answer either way — no enumeration, no stray accounts).
  `link_customer_account()` links the confirmed auth user to the oldest customer with that email on first
  visit; it never creates customers. Customers read only their own stamps/rewards/passport (RLS via
  `is_own_customer`). Programme + rules are public (homepage band and passport page read the active version,
  cached under the `loyalty` tag).
- **T88 — Emails**: after a paid order with stamps, `passport_stamp` ("You collected Capri — 8/12") or, when the
  order completed a card, `reward_unlocked` instead — once per order (dedupe key `order:<id>`), only with a
  customer email and the template enabled. Manual adjustments don't email.
- **T89 — Expiry** (when a rule sets `expiry_months`): earned rows get `expires_at`; unused stamps past it are
  written off FIFO the next time the card settles (award, adjustment, reversal) — there is no scheduled job yet
  (M17), so a dormant card shows expired stamps until it next changes.

## Dashboard & exports (milestone 16)
- **T90 — One `dashboard_summary()` call** returns the whole dashboard as jsonb and trims it by permission:
  money (revenue, by channel, outstanding, product revenue) needs `reports.view`; low stock needs
  `inventory.view`; events `events.view`; bookings `bookings.view`. Sales staff therefore see order counts,
  orders to handle, top products by units, stock, events. Revenue matches event reports (T73): orders not
  cancelled / awaiting website payment, by Asia/Dubai `placed_at` day, refunds net off on the day made.
  Each period compares with the same span before it (yesterday; same weekdays last week; same days last month).
- **T91 — Exports** at `/admin/exports/{orders|payments|customers|stock}?from&to&format=xlsx|csv`, reusing the
  report Excel/CSV writers (brand header, totals row). Orders/payments default to this month and cap at 366
  days; data comes from permission-checked `export_*` functions returning one jsonb document (no PostgREST row
  cap). Payment refunds are negative so the Amount total is money kept (succeeded only).
- **T92 — No-JS download form** on the dashboard: one GET form, each button sets its own `formAction`.

## Customer accounts & checkout (client feedback, 2026-10-15)
- **T93 — Checkout needs an account** (client request; replaces guest checkout, D5). Signed-out visitors
  can browse and fill the bag; `/checkout` opens on "Create an account / Sign in", then the delivery form
  (prefilled from the account). `placeOrder` rejects without a verified session and uses the account email.
- **T94 — Accounts are Supabase Auth users; email verified by a 6-digit code we send** through our email
  provider (Resend; dev logs it): sign-up creates an unconfirmed user (admin API), the code is a Supabase
  recovery OTP (`generateLink`), entering it confirms the email and signs in. The same code flow handles
  first sign-in of an unverified account and "forgot password". Hosted Supabase has no SMTP of its own, so
  Supabase never emails customers. Unverified accounts can't sign in, so `link_customer_account()`
  (passport) only ever links verified emails. Code emails are system emails (not owner-editable).
- **T95 — Profile in `user_metadata`** (first/last name, mobile, saved address); **order history** = orders
  placed while signed in (`app_metadata.order_ids`, server-written) + orders of the linked customer record.
  No schema change.
- **T96 — Light checkout**: own layout (`app/(checkout)`, logo + "Secure checkout" only), `.theme-light`
  (warm white, ink, burgundy). Steps Bag / Account / Delivery / Payment; order summary column (folds on
  phones). Account page and sign-in drawer use the same light theme.
- **T97 — "Plan your event" is locked** (`soon: true` in `storeNav`): greyed with a "Soon" tag in the header,
  menu and footer; `/events` shows a Coming soon card. Booking code and quote links are untouched.

## Client answers (2026-10-15)
- **T98 — Legal seller details are not published** (client): Terms/Privacy name "Solei" only; no
  licence, address or legal entity. Policies point to the Contact us page until the support email and
  WhatsApp are supplied (then set in Admin → Settings → Contact details).
- **T99 — Policies publish-ready**: handover §04 wording with the "to confirm" items resolved from the
  client's answers (returns 7 days; passport after two products in one order; essential cookies only).
  Migration `20261015000002_client_answers.sql`; owner edits continue in Admin → Settings → Help & policies.
- **T100 — Email via Resend** once the domain DNS is available; photography comes last.
