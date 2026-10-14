# Progress

Phase 1 milestones (one branch + PR each, in order). See `docs/BUILD_PROMPT.md` §9.

| # | Branch | Status | PR |
|---|---|---|---|
| 0 | `chore/bootstrap` | ✅ merged | [#1](https://github.com/Sujal85526/solei/pull/1) |
| 1 | `feat/design-system` | ✅ merged | [#2](https://github.com/Sujal85526/solei/pull/2) |
| 2 | `feat/homepage` | ✅ merged | [#3](https://github.com/Sujal85526/solei/pull/3) |
| 3 | `feat/schema-core` | 🔄 in review | |
| 4 | `feat/admin-auth-staff` | ⬜ | |
| 5 | `feat/admin-catalog-inventory` | ⬜ | |
| 6 | `feat/storefront-shop-cart` | ⬜ | |
| 7 | `feat/checkout-payments` | ⬜ | |
| 8 | `feat/orders-admin-notifications` | ⬜ | |
| 9 | `feat/manual-orders-payment-links` | ⬜ | |
| 10 | `feat/customers` | ⬜ | |
| 11 | `feat/event-calendar` | ⬜ | |
| 12 | `feat/event-pos` | ⬜ | |
| 13 | `feat/event-reports` | ⬜ | |
| 14 | `feat/event-booking` | ⬜ | |
| 15 | `feat/loyalty-passport` | ⬜ | |
| 16 | `feat/dashboard-exports` | ⬜ | |
| 17 | `chore/hardening` | ⬜ | |

## Current notes
- Schema: `supabase/migrations/2026101400000{1..9}_*.sql`; DB tests `pnpm exec supabase test db`; demo seed is
  generated from `src/modules/content/seed.ts` via `pnpm db:seed:generate`.
- Local Supabase: `pnpm db:start`; copy keys from `pnpm exec supabase status` into `.env.local` (see `.env.example`).

## Carry-overs
- **M15 (loyalty):** homepage passport band still uses launch defaults in `src/modules/content/queries.ts`
  (`passportDefaults`) — switch to the active loyalty rule version.
- **M17 (hardening):** Lighthouse mobile on `/` measured locally at perf 90–91, a11y 100, best-practices 96
  (404 prefetches of not-yet-built routes), SEO 100. Re-check with real client photography.
