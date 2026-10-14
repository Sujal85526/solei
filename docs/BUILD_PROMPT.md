# Solei — Build Prompt (Phase 1)

> Paste everything below the line into a fresh Claude Code session started in `~/personal/solei`.

---

You are building **Solei** — a production web platform for a UAE (Abu Dhabi) destination-led fragrance brand.
It has three products in one codebase: (1) an **event booking platform** + private exhibition calendar,
(2) an **e-commerce shop with admin, inventory and an event POS**, (3) a **configurable loyalty programme
(Solei Passport)**. You will build Phase 1 end to end, feature by feature, on a GitHub repo with one branch
and one PR per feature.

## 0. Read first (source of truth)

1. `docs/requirements.md` — all business requirements, Phase 1 scope, deferred Phase 2/3 items, open questions.
2. `docs/brand/brand-guidelines.md` — colours, type, logo, story, tagline, collection, design direction.
3. `docs/brand/ref-3.jpeg` (logo), `docs/brand/company-profile.pdf` (4 pages of real brand photography and
   layout cues — look at it).

If this prompt and those files disagree, the files win. If something is genuinely undecided (see §11), build it
**configurable** with a sensible default and list it in `docs/DECISIONS.md` — never block on it.

## 1. Non-negotiable principles

- **Owner self-service.** Anything the client may want to change — products, prices, packages, booths, flower
  add-ons, event types, loyalty rules, VAT rate, delivery fees, notification templates, staff permissions —
  lives in the database and is editable in the admin. No business rule hard-coded in components.
- **One sales ledger.** Every sale from every channel (website, event POS, WhatsApp/manual, direct, payment link,
  booking) is a row in the same `orders` table with a `channel`. Payments are separate rows (an order can be
  partially paid). Payment status is derived, never typed in.
- **Inventory is a movement ledger.** Stock is never a mutable number; it is `sum(stock_movements.qty)` per
  variant per location. Every sale, receipt, transfer, damage, correction and reward redemption is a movement.
- **Built to extend.** Phase 2/3 (gift cards, promotions engine, points/VIP, abandoned cart, WhatsApp API,
  courier API, attendance) must slot in without a rebuild: use enums/lookup tables, provider adapters and
  service modules (see §4).
- **Security first.** Card data never touches our servers (hosted checkout). Order paid ⇢ only via verified
  gateway webhook. Supabase RLS on every table. Server-side permission checks on every admin action.
- **Mobile/iPad-first admin.** The owner runs the business from a phone at exhibitions: large tap targets,
  bottom nav on mobile, POS usable one-handed.
- **Money** stored as integer **fils** (AED × 100). Timezone **Asia/Dubai** for all business dates
  (per-day event sales, reports).

## 2. Tech stack

| Concern | Choice |
|---|---|
| App | Next.js (App Router, latest stable) + TypeScript (strict) + React Server Components + Server Actions |
| UI | Tailwind CSS + shadcn/ui (restyled to the brand), lucide icons, Framer Motion (subtle only) |
| DB / Auth / Storage | Supabase (Postgres, Auth with TOTP MFA, Storage, RLS). Local dev via `npx supabase start` (Docker is installed) |
| Migrations / types | SQL migrations in `supabase/migrations`, generated TS types (`supabase gen types`) |
| Validation | Zod (shared between client forms and server actions) |
| Forms | react-hook-form + zod resolver |
| Payments | `PaymentProvider` adapter; first implementation **Stripe** (UAE supported, cards + Apple Pay, Checkout Sessions, Payment Links, webhooks) in **test mode** only |
| Email | `EmailProvider` adapter; Resend + React Email templates |
| WhatsApp | `MessagingProvider` adapter; Phase 1 = no API — generate `wa.me` click-to-chat links with prefilled text. Real WhatsApp Business API is Phase 3 |
| Charts | Recharts |
| Exports | Excel via `exceljs`, CSV; (PDF is Phase 2) |
| Testing | Vitest (unit: pricing, stock, loyalty, permissions), Playwright (e2e happy paths) |
| Quality | ESLint, Prettier, `tsc --noEmit`; GitHub Actions CI running lint + typecheck + unit tests + build |
| Package manager | pnpm |
| Hosting (later) | Vercel + Supabase cloud — **do not create cloud accounts/projects; ask the user** |

## 3. Git & GitHub workflow (do this exactly)

- GitHub account: **Sujal85526** (`gh` is already authenticated). Git identity for `~/personal` is set
  automatically — do not change git config.
- Bootstrap: `git init -b main`, create **private** repo `Sujal85526/solei` with
  `gh repo create Sujal85526/solei --private --source . --remote origin`, push `main`.
- `.gitignore` must exclude: `.env*` (except `.env.example`), `node_modules`, `.next`, `supabase/.temp`,
  `playwright-report`, `test-results`, `docs/brand/company-profile.pdf` (17 MB — keep local only),
  any screenshots folder. **Never commit secrets or keys.** Provide `.env.example` with every variable.
- **One branch per feature** from up-to-date `main`, named as in §9 (`feat/…`, `chore/…`, `fix/…`).
- Small, meaningful commits using Conventional Commits (`feat(pos): add quick-sale grid`).
- **No AI attribution anywhere**: no `Co-Authored-By` trailers, no "Generated with Claude Code" in commits,
  PR titles/bodies or merge messages.
- Per feature: push branch → `gh pr create` with body sections **Problem / Work / DB changes / How to test /
  Screenshots (describe, don't commit images)** → wait for CI green → **stop and ask the user whether to
  merge**: give the PR link, a short summary of what changed, CI status, and anything they should check.
  Only after they say yes: `gh pr merge --squash --delete-branch` → `git checkout main && git pull` → next
  feature. Never merge without an explicit OK for that PR. You may create branches, commit, push and open PRs
  without asking.
- Never force-push `main`. If CI fails, fix on the branch before merging.
- After each merge, append a line to `docs/CHANGELOG.md` and tick the milestone in `docs/PROGRESS.md`.

## 4. Architecture

```
src/
  app/
    (store)/            public site: home, shop, product, destinations, cart, checkout, events booking, passport, account
    (admin)/admin/      dashboard, orders, pos, products, inventory, customers, calendar, bookings, loyalty, reports, staff, settings
    api/webhooks/       payment webhooks (signature-verified, idempotent)
  modules/              domain logic — no UI; each has service.ts, schema.ts (zod), queries.ts, tests
    catalog/ inventory/ orders/ payments/ customers/ bookings/ events/ loyalty/ notifications/ staff/ reports/ settings/
  providers/            payment/, email/, messaging/ — interface + implementations (stripe, resend, wa-link)
  components/ui         shadcn primitives (branded)
  components/store      storefront components
  components/admin      admin components
  lib/                  money.ts (fils), dates.ts (Asia/Dubai), phone.ts (E.164, UAE +971), permissions.ts, audit.ts
supabase/migrations/    schema, RLS, triggers, seed.sql
```

Rules: UI calls server actions → server actions call `modules/*/service.ts` → services do permission check +
validation + DB writes in a transaction (Postgres functions/RPC for multi-row writes like "complete sale").
Every mutating service writes an `audit_log` row (who, what, entity, before/after JSON).

## 5. Data model (Phase 1 — adjust names as needed, keep the concepts)

**Catalog**
- `categories` (perfume, all_over_spray, dukhoon, … — editable, sortable)
- `destinations` (name, slug, country/region, story, mood, hero image, postcard image, accent colour, sort)
- `products` (category, destination, name, slug, description, notes top/heart/base, images[], active, featured)
- `product_variants` (product, size_ml, sku, price_fils, cost_fils, barcode?, active) — the **stock unit**
- `product_images` / Supabase Storage bucket `products`

**Inventory**
- `stock_locations` (main warehouse; one auto-created per event, `event_id` nullable; active)
- `stock_movements` (variant, location, qty ±, type: `receive | sale | refund_return | transfer_out | transfer_in |
  damage | adjustment | reward_redemption`, reason, order_line_id?, event_id?, created_by, created_at)
- view `stock_levels` (variant × location → on_hand); `low_stock_threshold` per variant; low-stock alert to owner

**Customers**
- `customers` (name, phone E.164 unique, email, emirate, address JSON, marketing_consent + timestamp, source, notes)
- dedupe by normalised phone; manual/POS sales attach by phone search or quick-create

**Orders & payments**
- `orders` (number `SOL-000123`, customer, channel: `website | pos | whatsapp | direct | payment_link | booking`,
  event_id?, event_day date?, staff_id, status: `new | preparing | dispatched | delivered | completed | cancelled`,
  fulfilment: `delivery | pickup | handed_over`, delivery address/fee, subtotal, discount, vat, total (fils),
  vat_rate snapshot, notes, client_uuid for idempotency)
- `order_lines` (variant, qty, unit_price_fils, unit_cost_fils **snapshot**, discount, is_reward)
- `payments` (order, amount_fils, method: `online_card | apple_pay | cash | card_terminal | soft_pos |
  bank_transfer | payment_link`, status: `pending | succeeded | failed | refunded`, provider ids, received_by, at)
- view/derived `payment_status`: `paid | partially_paid | pending` + `outstanding_fils`
- `payment_links` (order or booking, amount, provider url/id, expires_at, status)
- `order_status_history`

**Events & calendar**
- `events` (type: `exhibition | popup | private_booking | other`, status: `potential | confirmed | completed |
  cancelled`, name, organiser name/contact, location, emirate, start/end dates, daily hours JSON, booth details,
  participation_fee_fils, fee_payment_status, notes, booking_id?)
- `event_staff` (event, staff), `event_expenses` (event, category: staff/transport/setup/other, amount, note,
  receipt file), `event_documents` (Storage bucket `event-docs`)
- event stock: allocation = `transfer_out` main → event location; close-out = return remaining to main

**Bookings (customer-facing)**
- config tables: `booking_event_types`, `booking_service_types` (display booth, guest giveaways, customised
  arrangements), `booking_packages` (name, description, inclusions[], base price, images[], active, sort),
  `booth_designs` (name, photos[], active), `flower_options` (none / add; colours list; price rule)
- `bookings` (ref `BK-0001`, customer, event type, date, start/end time, location, emirate, guests, products of
  interest + quantities JSON, service types, package, booth, flowers choice + colour, special requests,
  status: `requested | in_review | quoted | accepted | confirmed | completed | rejected | cancelled`)
- `booking_quotes` (versioned lines + total, deposit_fils, valid_until, sent_at, accepted_at)
- `booking_messages` (direction in/out/internal-note, channel email/whatsapp-link, body, by)

**Loyalty (Solei Passport)**
- `loyalty_programs` (single active row) + `loyalty_rule_versions` (stamps_per_item, qualifying category ids /
  product ids, stamps_for_reward, reward_type: `choose_from_category | specific_products | fixed_amount | percent`,
  reward config, issue_passport_after_purchases, reward_items_earn_stamps, expiry_months?, active,
  effective_from) — rules versioned, existing stamps kept when rules change
- `loyalty_stamps` (customer, order_line?, destination, stamps ±, kind: `earned | redeemed | reversed |
  manual`, reason, rule_version, created_by, expires_at?)
- `loyalty_rewards` (customer, status `available | redeemed | expired`, redeemed_order_id)
- `passports` (customer, issued_at, issued_by, how: `auto | request | manual`)

**Staff & security**
- `staff_profiles` (auth user, name, position, phone, employment status, active)
- `roles` (owner, manager, sales_staff — editable) + `permissions` + `role_permissions` (permission keys like
  `orders.create`, `reports.financial.view`, `inventory.adjust`, `staff.manage`); check with `can(user, key)`
- `audit_log` (actor, action, entity, entity_id, before, after, ip, at) — also login attempts

**Settings & notifications**
- `settings` (business name, TRN, vat_rate, prices_include_vat, currency, delivery zones/fees by emirate,
  free-delivery threshold, owner notification email/phone, low-stock default)
- `notification_templates` (key, channel, subject, body with `{{variables}}`, enabled) — editable in admin
- `notification_log` (customer, template, channel, to, status, sent_at)

RLS: public can read active catalog/config; customers read only their own orders/passport; staff access by
permission; `cost_fils`, profits, expenses and financial reports require `reports.financial.view`.

## 6. Phase 1 features & acceptance criteria

### 6.1 Design system + homepage (the client wants to see this first)
- Tokens: burgundy `#460328` (dominant), baby pink `#F7CDD0` (accent: buttons, details, select sections),
  warm cream paper (pick ≈ `#F6EEE8`, document it), muted gold for hairlines/details (≈ `#B08D57`), near-black
  burgundy for text on cream. Verify WCAG AA for every text/background pair actually used (pink text on cream
  fails — don't use it for body copy).
- Type: brand font "Nove" isn't licensed for web yet → use a refined high-contrast serif for display
  (e.g. via `next/font/google`) + clean sans for UI, wired through CSS variables so the real font can be dropped
  in later by changing one file. Letter-spaced small caps for labels (as in the company profile).
- Feel: **luxury travel editorial** — unisex, sophisticated, minimal, generous whitespace, large photography.
  Subtle travel motifs only: postmark wavy lines, stamp-perforated edges, postcard frames, a thin arch with
  palm, passport. Never kitschy or crowded.
- Homepage sections (all content from DB/settings where reasonable):
  1. Hero: full-bleed photography, logo, "A destination in scent." + tagline **"Made to remain."**, CTAs
     *Shop the collection* and **Plan your event** (event service must be obvious on the homepage — not hidden).
  2. **Shop by destination**: 8 postcard cards (Cannes, Marbella, Verona, Capri, Santorini, Soho, Monaco,
     Mayfair) → destination pages showing that scent's products.
  3. The collection: perfumes / all-over sprays with prices (AED 280 / AED 190).
  4. **Plan your event** feature band: weddings, engagements, corporate… with booth photo and CTA.
  5. **Solei Passport** band: collect the destinations, stamps visual, "12 stamps = a free all-over spray"
     (read from loyalty settings, not hard-coded).
  6. Brand story (from guidelines), Instagram @solei.ad strip, newsletter/WhatsApp opt-in with consent.
  7. Footer: Abu Dhabi, UAE, contact, policies, socials.
- Responsive (360px → 1440px+), Lighthouse ≥ 90 performance/accessibility on mobile, `next/image` everywhere,
  reduced-motion respected. Use real brand images extracted from the company profile where usable, otherwise
  tasteful placeholders clearly marked in `docs/DECISIONS.md` as "replace with client photography".

### 6.2 Catalog, shop, cart, checkout
- Shop, category, destination and product pages (images, description, notes, size, price, stock-aware "add to
  cart"; sold-out state).
- Cart (multi-item, persistent), guest checkout requiring **name, mobile (UAE format), email, full address,
  emirate**; delivery fee by emirate from settings; VAT per settings.
- Pay via Stripe hosted Checkout (cards + Apple Pay). Order is created `pending`; becomes confirmed **only from
  the verified webhook** (idempotent; duplicate webhook = no double stock/stamps). On success: stock movement
  `sale`, loyalty stamps, notifications. Failed/abandoned payment: order stays unpaid, customer gets retry link.
- Order tracking page by order number + phone (New → Preparing → Dispatched → Delivered, tracking no. field).

### 6.3 Admin auth, staff, roles, audit
- Supabase Auth email/password; **TOTP MFA required** for owner/manager. Staff accounts created/deactivated
  by owner; roles & permissions editable; deactivated users lose access immediately.
- Sales staff see: POS, orders they need, product availability, customers (no costs/profits/expenses/reports).
- Audit log viewer with filters (user, action, date).

### 6.4 Products & inventory admin
- CRUD categories/destinations/products/variants with image upload; change prices; activate/deactivate.
- Stock: receive stock, record damage, correction (reason required), transfer between locations; stock by
  variant × location; low-stock list + alert email; movement history per variant.
- Acceptance: 100 in stock, sell 20 web + 30 at an event + 10 WhatsApp → shows 40 (unit test + e2e).

### 6.5 Orders, manual orders, payment links, outstanding
- Orders list with filters (channel, status, payment status, date, event), detail page, status changes with
  history, record additional payments (cash/transfer/etc.), cancel (returns stock, reverses stamps), refund
  record.
- **Manual order entry** (WhatsApp/direct): pick customer (search by phone/name or quick-create), variants,
  qty, price override with reason, payment received now / partial / later.
- **Payment link** generation (Stripe Payment Links or Checkout Session URL) for any order/booking amount;
  "Share on WhatsApp" button opens `wa.me` with prefilled message; webhook marks payment.
- **Outstanding payments** screen: customers with unpaid balances, amounts, age, one-tap send reminder link.

### 6.6 Customers (basic CRM)
- Auto-created/updated from every order; search by name/phone; profile shows all orders across channels,
  total spent, last purchase, passport stamps, notes, marketing consent.

### 6.7 Private event & exhibition calendar
- Month/week/list calendar (owner + permitted staff only); colour by status (potential, confirmed, completed,
  cancelled) and type (exhibition vs private booking); **overlap warning** when dates clash.
- Event record: name, organiser details, location/emirate, dates, daily working hours, participation fee +
  payment status, booth details, assigned staff, expenses (with receipt upload), notes, documents.
- Stock allocation: choose variants + qty to take → transfer to the event location. Close event: shows sold vs
  remaining per variant → one tap returns remaining to main stock (editable for breakages).
- Confirmed customer bookings appear automatically.

### 6.8 Event POS (most-used screen — optimise ruthlessly)
- Select active event (defaults to today's) → grid of big product tiles (image, destination, price, stock left
  at this event) → tap to add, +/− qty → optional customer phone (for passport stamps) → payment method
  (cash / card terminal / soft POS / bank transfer; split payment allowed) → **Complete**. Target: a 2-perfume
  sale in ≤ 5 taps without a customer, ≤ 8 with phone.
- Sales stamped with `event_id`, `event_day` (Asia/Dubai), `staff_id`; stock deducted from the event location.
- Resilient to poor exhibition Wi-Fi: every sale gets a client UUID (idempotent); if offline, queue in
  IndexedDB and auto-sync with a visible "n sales waiting to sync" badge. (PWA installable on iPad/iPhone.)
- Today's running totals visible on the POS (units, revenue, by payment method).

### 6.9 Event reports & comparison
- Per event, **per day** and total: units by product/variant/destination, by category (perfume / spray /
  dukhoon), revenue, payment-method breakdown, best sellers, stock allocated / sold / returned, expenses +
  participation fee, COGS (from line cost snapshots), gross profit, profit margin.
- Compare events side by side (table + bar charts): revenue, units, profit, revenue per day.
- Export any report to Excel.

### 6.10 Customer event booking ("Plan your event")
- Public multi-step wizard (progress indicator, mobile-friendly, saves draft locally):
  1. Event type 2. Date, start & end time, location, emirate, guests 3. Service type(s) 4. Package (cards with
  photos, inclusions, prices; compare view) 5. Booth design (photos) 6. Flowers: none (no charge) / add +
  colour (price added automatically) 7. Products of interest + quantities 8. Contact details + special requests
  9. Summary with estimated total → submit.
- Submit → booking `requested`, customer gets acknowledgement email, owner gets notified.
- Admin bookings inbox: review, internal notes, message the customer (email, or WhatsApp link — logged),
  build/adjust a **versioned quote** (lines, discounts, deposit amount, validity), send quote (email with
  accept link), approve/reject with reason, send payment link for deposit or full amount.
- Accepted + deposit paid (or manually confirmed) → `confirmed` → an `events` row of type `private_booking`
  is created automatically and appears in the calendar. Bookings can later carry POS/giveaway orders.
- All config (event types, services, packages, booths, flower colours/prices) editable in admin.

### 6.11 Solei Passport (loyalty)
- Launch rules = company profile p.3: 1 stamp per product, passport auto-issued after 2 purchases or on
  request, 12 stamps = 1 free all-over spray of choice, reward items don't earn stamps, no expiry.
  **Every one of these is an admin setting** (see data model); rule changes are versioned and apply going
  forward.
- Stamps accrue across orders and all channels (web, POS, manual) when the order has a customer; awarded only
  when the order is paid; reversed on cancel/refund.
- Each stamp shows its destination. Customer passport page (access via magic link to email / OTP to phone
  later) shows stamps as destination stickers on passport pages and progress "8 / 12".
- After each qualifying purchase customer gets "You collected Capri — 8/12" email (template editable).
- Redeem reward online (zero-priced line at checkout) or at POS; reward stock movement `reward_redemption`.
- Admin: per-customer stamp ledger, manual add/remove with reason (audited), issue passport, settings screen.
- Unit tests for: cumulative 1+1+2+3+5, threshold crossing in one order (e.g. 11 + 3 → 1 reward, 2 carried),
  reversal, rule change mid-way, reward items not earning.

### 6.12 Notifications
- Email templates (editable in admin, enable/disable each): order confirmation, payment received, payment
  failed + retry, status updates (preparing/dispatched/delivered), booking received, quote sent, booking
  confirmed, passport stamp progress, reward unlocked; owner: new order, new booking, low stock.
- All sends logged in `notification_log`. Marketing sends only to consenting customers; unsubscribe link.

### 6.13 Dashboard & exports
- Owner dashboard: today/week/month revenue, orders, outstanding total, revenue by channel, top products,
  low stock, upcoming events, pending bookings. Sales staff see a reduced dashboard.
- Excel/CSV export for orders, payments, customers, stock levels, event reports.

## 7. Phase 2/3 extension points (do not build; don't block)
Gift cards (`payments.method = gift_card`), promotions/discount engine (order-level `discount` + `applied_promotions`),
points & VIP tiers (loyalty program types), giveaways customiser (products with option groups + price
modifiers), abandoned carts, WhatsApp Business API (`MessagingProvider`), courier API (`fulfilments` table),
staff attendance, PDF reports, Arabic/RTL (keep copy in a dictionary file, use logical CSS properties
`ms-/me-/ps-/pe-` from day one).

## 8. Quality bar / Definition of Done (every feature)
- Typecheck, lint, unit tests and build pass in CI; new domain logic has unit tests.
- Playwright e2e for the main happy path of the feature.
- Works at 375px (iPhone), 820px (iPad) and desktop; manually verified by running the app.
- RLS + permission checks for new tables/actions; audit log entries for mutations.
- Migrations reversible-safe, seed data updated.
- No hard-coded business values that the owner could reasonably want to change.

## 9. Milestones → branches (in this order, one PR each)

| # | Branch | Scope |
|---|---|---|
| 0 | `chore/bootstrap` | repo + GitHub, Next.js/TS/Tailwind/shadcn, pnpm, ESLint/Prettier, Vitest/Playwright, CI, local Supabase, `.env.example`, project `CLAUDE.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/CHANGELOG.md` |
| 1 | `feat/design-system` | tokens, fonts, branded shadcn, layout shells (store + admin), travel motifs as reusable components |
| 2 | `feat/homepage` | §6.1 homepage with seed content (show the user screenshots when done) |
| 3 | `feat/schema-core` | catalog, inventory, customers, orders, payments, settings, staff/permissions, audit migrations + RLS + seed (8 destinations, 5 perfumes AED 280, 3 sprays AED 190) |
| 4 | `feat/admin-auth-staff` | §6.3 |
| 5 | `feat/admin-catalog-inventory` | §6.4 |
| 6 | `feat/storefront-shop-cart` | §6.2 browse + cart |
| 7 | `feat/checkout-payments` | §6.2 checkout, Stripe adapter, webhook, order tracking |
| 8 | `feat/orders-admin-notifications` | §6.5 order management + §6.12 email infra & templates |
| 9 | `feat/manual-orders-payment-links` | §6.5 manual orders, payment links, outstanding |
| 10 | `feat/customers` | §6.6 |
| 11 | `feat/event-calendar` | §6.7 |
| 12 | `feat/event-pos` | §6.8 incl. offline queue + PWA |
| 13 | `feat/event-reports` | §6.9 |
| 14 | `feat/event-booking` | §6.10 public wizard + admin inbox/quotes + calendar link |
| 15 | `feat/loyalty-passport` | §6.11 |
| 16 | `feat/dashboard-exports` | §6.13 |
| 17 | `chore/hardening` | security review (RLS audit, webhook replay, rate limits on public forms, headers/CSP), accessibility + Lighthouse pass, seed demo data, README (setup, env, deploy) |

## 10. Stop and ask the user before
- Creating any cloud resource or account (Vercel, Supabase cloud, Stripe live, Resend domain, Meta/WhatsApp).
- Using live payment keys, sending real emails/WhatsApp messages to anyone but test addresses.
- Changing scope beyond §6, or anything destructive to the repo history.

## 11. Open questions (build configurable defaults; record in `docs/DECISIONS.md`)
VAT registration/TRN and inclusive vs exclusive pricing (default: 5%, prices inclusive) · English only vs Arabic
(default: English, RTL-ready) · delivery zones/fees per emirate · refund/return policy · customer accounts vs
guest (default: guest + magic-link passport) · which scents are perfume vs spray (inferred from profile:
perfumes Cannes, Marbella, Verona, Capri, Santorini; sprays Soho, Monaco, Mayfair — confirm) · dukhoon products
· deposit % for bookings (default 50%) · booth availability limits · final package prices · Nove web licence ·
payment gateway final choice (Stripe vs Tap/Network International — adapter keeps this swappable).

## 12. How to work
- Start with milestone 0, then proceed sequentially. At the start of each milestone, re-read the relevant
  section here and in `docs/requirements.md`; write a short plan in the PR description.
- After milestone 2 (homepage) pause and show the user screenshots before continuing — the client is waiting
  on the design.
- Keep `docs/PROGRESS.md` current so work can resume in a new session at any point.
