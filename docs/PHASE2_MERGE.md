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
