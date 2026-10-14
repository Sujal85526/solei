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
| 7 | `feat/checkout-payments` | 🔄 in review | |
| 8 | `feat/orders-admin-notifications` | ⬜ | |
| 9 | `feat/manual-orders-payment-links` | ⬜ | |
| 10 | `feat/customers` | ⬜ | |
| 11 | `feat/event-calendar` | 🔄 in review | [#10](https://github.com/Sujal85526/solei/pull/10) |
| 12 | `feat/event-pos` | ⬜ | |
| 13 | `feat/event-reports` | ⬜ | |
| 14 | `feat/event-booking` | ⬜ | |
| 15 | `feat/loyalty-passport` | ⬜ | |
| 16 | `feat/dashboard-exports` | ⬜ | |
| 17 | `chore/hardening` | ⬜ | |

## Current notes
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

## Carry-overs
- **M8 (notifications):** low-stock alert email to the owner (low-stock detection exists in
  `src/modules/inventory/queries.ts` → `stockMatrix()`); send when a movement crosses the threshold.
- **M7/M12:** call `updateTag("stock")` / `revalidateTag("stock")` after sales so storefront availability refreshes.
- **M15 (loyalty):** homepage passport band still uses launch defaults in `src/modules/content/queries.ts`
  (`passportDefaults`) — switch to the active loyalty rule version.
- **M17 (hardening):** Lighthouse mobile on `/` measured locally at perf 90–91, a11y 100, best-practices 96
  (404 prefetches of not-yet-built routes), SEO 100. Re-check with real client photography.
