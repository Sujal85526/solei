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
