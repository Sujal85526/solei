# Phase 2 — merge checklist

The hosted Supabase DB is shared with the live site (which runs `main`). Phase 2 migrations
(`20261024000001`–`…007`) are written so `main` keeps working on top of them (checked by running
main's checkout, POS, orders-admin and staff e2e against a DB with all Phase 2 migrations applied).
What had to wait for the merge is listed here — do these **after** `phase-2` is merged and deployed.

## 1. Grant the Phase 2 permissions to the manager role
`main`'s role editor rejects permission keys it doesn't know, so the Phase 2 migrations only create
the permissions (the owner holds every permission implicitly). After the merge, add a migration:

```sql
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r
  cross join (values ('gift_cards.view'), ('gift_cards.manage'), ('marketing.manage')) p(key)
 where r.key = 'manager'
on conflict do nothing;
```
(or tick them in Admin → Staff → Roles → Manager.)
Business reports (`p2/reports`) add **`expenses.manage`** (add/edit business expenses): grant it the same way
if managers should keep the expenses list (it's a financial permission; they also need `reports.financial.view`).
Apply `20261030010001_business_expenses.sql` and `20261030010002_business_report.sql` before deploying, or the
Business report page errors (the dashboard profit KPI just hides itself).

## 2. Drop the old coupon flag
`coupons.once_per_customer` stays while `main` writes it; `coupon_evaluate` treats it as a limit of 1
when `per_customer_limit` is empty, and Phase 2 keeps it in step. After the merge: remove the
`once_per_customer` line in `src/modules/coupons/service.ts` and the fallback in `queries.ts`, then:

```sql
update public.coupons set per_customer_limit = 1 where once_per_customer and per_customer_limit is null;
alter table public.coupons drop column once_per_customer;
```
…and redefine `coupon_evaluate` without the `once_per_customer` fallback.

## 3. While both run on the same DB (before the merge)
- Testing a Phase 2 preview against the shared DB writes real rows (orders, customers, gift cards,
  campaign sends) into the live database. Use clearly named test data and clean it up.
- Don't create **free-delivery** codes until the merge: the live checkout doesn't know them (the
  database refuses such an order with "your discount changed", so nothing is mis-charged).
- New notification templates (gift card, bag reminder, campaign) appear in the live site's
  Settings → Notifications; leave them as they are.

## 4. Giveaways (migration `20261024000010`, not on the hosted DB yet)
`create_web_order`, `coupon_evaluate` and `cart_sync` are redefined with the same signatures; orders from `main`
(no options) work unchanged for products without choices. Don't add choices or a minimum to a product on the
shared DB until the merge — `main`'s checkout can't send choices, so such a product would be refused there.

## 5. Giveaways & occasions, Plan your event (migrations `20261030020001`–`…012`, branch `p2/giveaways`)
- Apply them **before** deploying the phase-2 code that uses them: the storefront product query now reads
  `product_options.image_url`, and the giveaways pages, till and New order read `giveaway_occasions` /
  `giveaway_items` — against a DB without them those pages fail.
- Main-safe: new tables/columns have defaults; `create_web_order`, `coupon_evaluate`, `cart_sync`,
  `pos_complete_sale`, `create_manual_order`, `submit_booking`, `product_option_group_save` keep their
  signatures, and lines without `options` / `giveaway_id` behave as before (main's POS and manual orders were
  not re-run end-to-end; the existing SQL tests pass on a local replay). `event_type` gains `wedding`; main
  doesn't list it, and main's calendar has no icon for it (`typeIcon`), so **don't save a calendar event as
  Wedding on the shared DB until the merge** — the live calendar could fail to render it.
- Event types are renamed on the shared DB by `…010` (Ramadan → Ramadan Gathering, etc.; Birthday switched off) —
  the live site shows the new names at once, which is what the owner asked for.
- Don't mark a product "Sell this as a giveaway" on the shared DB until the merge: main's checkout can't send
  `giveaway_id` (giveaway products have no variants of their own, so main simply never shows them).
## 6. Scheduled jobs (CRM, staff & email automation, `p2/crm-staff`)
Every route needs `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it when `CRON_SECRET` is set) and
does nothing until its switch is on in the admin. Suggested schedule (times UTC; UAE = UTC+4):

| Route | What | Suggested |
|---|---|---|
| `/api/cron/cart-reminders` | Bag reminders (P2-8) | hourly — `0 * * * *` |
| `/api/cron/birthdays` | Birthday bonus points (P2-17) | daily 05:00 UAE — `0 1 * * *` |
| `/api/cron/tracking` | Courier tracking refresh (P2-22) | every 2 h — `0 */2 * * *` |
| `/api/cron/feedback-requests` | "How was your order?" after delivery (P2-74) | daily 11:00 UAE — `0 7 * * *` |
| `/api/cron/staff-reminders` | Staff event + shift reminders (P2-75) | hourly — `15 * * * *` |
| `/api/cron/event-digest` | Owner's next-7-days events digest (P2-75) | daily 08:00 UAE — `0 4 * * *` |

Proposed `vercel.json` block (**not added**: Vercel Hobby allows only daily crons, so the hourly ones need Pro or an
external pinger / Supabase `pg_cron` + `pg_net`):

```json
"crons": [
  { "path": "/api/cron/cart-reminders", "schedule": "0 * * * *" },
  { "path": "/api/cron/birthdays", "schedule": "0 1 * * *" },
  { "path": "/api/cron/tracking", "schedule": "0 */2 * * *" },
  { "path": "/api/cron/feedback-requests", "schedule": "0 7 * * *" },
  { "path": "/api/cron/staff-reminders", "schedule": "15 * * * *" },
  { "path": "/api/cron/event-digest", "schedule": "0 4 * * *" }
]
```

## 7. CRM, staff & email automation (migrations `20261030040001`–`…005`)
- All additive: new tables (`customer_feedback`, `staff_shifts`, `feedback_requests`), new columns with defaults
  on `settings`, `customers`, `campaigns`; `customer_summary` keeps its columns and adds two at the end;
  `segment_members` and `customer_unsubscribe` keep their signatures. No new permission keys (reuses
  `customers.*`, `staff.manage`, `reports.view`, `marketing.manage`, `settings.manage`) — nothing to grant.
- `notification_audience` gains `staff` (own migration, `…004`). main's Settings → Notifications lists only
  customer/owner templates, so the 3 staff templates are invisible there until the merge; leave them.
- New templates on the live list: `feedback_request`, `owner_event_digest`, `event_announcement` — leave them.
- Every automation switch (feedback requests, staff reminders, owner digest) is **off** by default; nothing sends
  until the owner turns it on and a scheduler calls the routes (§6).
- After the merge: regenerate `database.types.ts` (hand-edited here).

## 8. Promotions & loyalty, part 2 (migrations `20261030030001`–`…005`, branch `p2/promotions`)
- Needs the giveaways migrations (`20261030020002`/`…003`): `promo_price` calls the 3-argument
  `line_unit_price_fils`, and the redefined `create_web_order` / `pos_complete_sale` keep the giveaway logic.
- Main-safe while nothing new is set up: `coupon_evaluate`, `create_web_order`, `pos_complete_sale`,
  `coupon_uses`, `birthdays_due`, `points_birthday`, `loyalty_tiers_save` keep their signatures; with no offers,
  one code and no rewards they price exactly as before (SQL tests 120/130/160 unchanged). Existing codes stay
  website-only and non-combining.
- **Don't create offers (sale prices, bundles, buy X get Y), till/VIP/combinable codes, rewards or early-access
  launch dates on the shared DB until the merge:** main's checkout sends catalogue prices and one code, so a
  live sale would make the database refuse main's orders ("prices changed"), and main's admin doesn't know the
  new code kinds. Banners are harmless (main doesn't read them). Keep `birthday_reward = points` until then.
- The till sends `apply_offers`; sales queued offline by main's till are priced at catalogue prices.
- New: bucket `banners` (public), template `birthday_code` (appears in the live Settings → Notifications list;
  leave it). No new permission keys (`coupons.manage`, `loyalty.*`, `reports.view`, `pos.use`).
- After the merge: regenerate `database.types.ts` (hand-edited here).

