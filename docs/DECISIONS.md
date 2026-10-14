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
