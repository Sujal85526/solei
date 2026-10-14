# Progress

Phase 1 milestones (one branch + PR each, in order). See `docs/BUILD_PROMPT.md` §9.

| # | Branch | Status | PR |
|---|---|---|---|
| 0 | `chore/bootstrap` | ✅ merged | [#1](https://github.com/Sujal85526/solei/pull/1) |
| 1 | `feat/design-system` | ✅ merged | [#2](https://github.com/Sujal85526/solei/pull/2) |
| 2 | `feat/homepage` | 🔄 in review | |
| 3 | `feat/schema-core` | ⬜ | |
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
- Local Supabase: `pnpm db:start`; copy keys from `pnpm exec supabase status` into `.env.local` (see `.env.example`).

## Carry-overs
- **M3 (schema-core):** persist homepage opt-in (`src/modules/marketing/service.ts`) to customers with consent
  timestamp; switch `src/modules/content/queries.ts` from seed constants to DB reads (destinations, prices,
  loyalty rule, Instagram from settings).
- **M17 (hardening):** Lighthouse mobile on `/` measured locally at perf 90–91, a11y 100, best-practices 96
  (404 prefetches of not-yet-built routes), SEO 100. Re-check with real client photography.
