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
| 8 | `feat/orders-admin-notifications` | ✅ merged | [#14](https://github.com/Sujal85526/solei/pull/14) |
| 9 | `feat/manual-orders-payment-links` | 🔄 in review |  |
| 10 | `feat/customers` | ✅ merged | [#15](https://github.com/Sujal85526/solei/pull/15) |
| 11 | `feat/event-calendar` | ✅ merged | [#10](https://github.com/Sujal85526/solei/pull/10) |
| 12 | `feat/event-pos` | ✅ merged | |
| 13 | `feat/event-reports` | 🔄 in review | |
| 14 | `feat/event-booking` | ✅ merged | [#16](https://github.com/Sujal85526/solei/pull/16) |
| 15 | `feat/loyalty-passport` | 🔄 in review | [#19](https://github.com/Sujal85526/solei/pull/19) |
| 16 | `feat/dashboard-exports` | ⬜ | |
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

## Carry-overs
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
- ~~**M15 (loyalty):** passport panel placeholder, homepage band defaults~~ — done in M15 (T79–T86).
- **M15 → M12 (POS):** sales through `settle_if_paid` earn stamps automatically. To redeem at the till call
  `loyalty_redeem_reward(reward_id, variant_id, p_order_id => <open POS order>)` (allowed with `pos.use`);
  available rewards: `loyalty_rewards` where `status = 'available'`. Any redefinition of `after_order_paid` /
  `after_order_cancelled` must keep the loyalty calls.
- **M15 TODO — online reward redemption at checkout**: offer a signed-in passport holder's available reward as a
  zero-priced line in checkout. Needs: passing `reward_id` + variant to `create_web_order` (customer must match
  the passport), a hold on the reward while the order is `pending_payment` (released for abandoned checkouts),
  and marking it redeemed in `after_order_paid`. Until then the passport page says "redeem at a pop-up / on
  WhatsApp".
- **M17 (loyalty):** scheduled stamp expiry (only matters if the owner turns expiry on — T86); rate-limit the
  passport magic-link form.
- **M17 (hardening):** Lighthouse mobile on `/` measured locally at perf 90–91, a11y 100, best-practices 96
  (404 prefetches of not-yet-built routes), SEO 100. Re-check with real client photography.
