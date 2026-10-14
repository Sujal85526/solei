# Decisions & open questions

Open client questions are built as configurable defaults. Each row: what we chose, why, and where to change it.

| # | Topic | Default chosen | Status | Where configurable |
|---|---|---|---|---|
| D1 | VAT | 5%, prices **inclusive**; stored as basis points (500) | ❓ confirm TRN / registration | `settings.vat_rate`, `settings.prices_include_vat` |
| D2 | Language | English only, RTL-ready (logical CSS, copy dictionary) | ❓ confirm Arabic need | — |
| D3 | Delivery zones/fees | Per-emirate fee table + free-delivery threshold | ❓ client to give fees | `settings` (admin) |
| D4 | Refund / return policy | Placeholder policy page | ❓ client to supply | CMS/settings |
| D5 | Customer accounts | Guest checkout + magic-link passport page | ❓ confirm | — |
| D6 | Perfume vs spray split | Perfumes: Cannes, Marbella, Verona, Capri, Santorini; sprays: Soho, Monaco, Mayfair (inferred from profile) | ❓ confirm | product catalog |
| D7 | Dukhoon products | Category exists, no products seeded | ❓ client to list | product catalog |
| D8 | Booking deposit | 50% | ❓ confirm | settings / per quote |
| D9 | Booth availability limits | Overlap **warning**, no hard block | ❓ confirm | — |
| D10 | Package prices | Placeholder prices | ❓ client to supply | booking packages admin |
| D11 | Brand font "Nove" | Web substitute via CSS variables until a web licence is supplied | ❓ licence + files | `src/app/fonts.ts` (milestone 1) |
| D12 | Payment gateway | Stripe (test mode) behind `PaymentProvider`; Tap / Network International remain swappable | ❓ confirm | `src/providers/payment` |

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
