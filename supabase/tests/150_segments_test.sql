begin;
\ir helpers/setup.psql
select plan(12);

-- Three test customers (unique emails so seed/dev data doesn't interfere).
insert into public.customers (name, email, emirate, marketing_consent, marketing_channels)
values ('Seg Big', 'seg.big@solei.test', 'dubai', true, '{email}') returning id as big \gset
insert into public.customers (name, email, emirate, marketing_consent, marketing_channels, unsubscribed_at)
values ('Seg Gone', 'seg.gone@solei.test', 'abu_dhabi', false, '{}', now()) returning id as gone \gset
insert into public.customers (name, email, emirate, marketing_consent, marketing_channels)
values ('Seg WhatsApp', 'seg.wa@solei.test', 'abu_dhabi', true, '{whatsapp}') returning id as wa \gset

select id as capri_dest from public.destinations where slug = 'capri' \gset
select id as capri from public.product_variants where sku = 'TST-P-CAP-50' \gset

-- Big spender: AED 560 of Capri, paid, 10 days ago.
insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment, placed_at, contact_email)
values (:'big', 'pos', 'completed', 56000, 56000, 'handed_over', now() - interval '10 days', 'seg.big@solei.test')
returning id as o1 \gset
insert into public.order_lines (order_id, variant_id, product_name, sku, destination_id, qty, list_price_fils, unit_price_fils, line_total_fils)
values (:'o1', :'capri', 'Capri Perfume', 'TST-P-CAP-50', :'capri_dest', 2, 28000, 28000, 56000);
insert into public.payments (order_id, amount_fils, method, status) values (:'o1', 56000, 'cash', 'succeeded');
-- Lapsed buyer: AED 190, 200 days ago.
insert into public.orders (customer_id, channel, status, total_fils, subtotal_fils, fulfilment, placed_at, contact_email)
values (:'gone', 'pos', 'completed', 19000, 19000, 'handed_over', now() - interval '200 days', 'seg.gone@solei.test')
returning id as o2 \gset
insert into public.payments (order_id, amount_fils, method, status) values (:'o2', 19000, 'cash', 'succeeded');

select tests.login_as(tests.create_staff('seg-owner@solei.test', 'owner'));

create function pg_temp.members(p jsonb) returns setof text language sql as $$
  select email from public.segment_members(p) where email like 'seg.%@solei.test' order by email;
$$;

select results_eq($$ select * from pg_temp.members('{}') $$,
  array['seg.big@solei.test', 'seg.gone@solei.test', 'seg.wa@solei.test'], 'empty rules = everyone');
select results_eq($$ select * from pg_temp.members('{"min_spent_fils": 50000}') $$,
  array['seg.big@solei.test'], 'spend at least AED 500');
select results_eq($$ select * from pg_temp.members('{"purchased_within_days": 30}') $$,
  array['seg.big@solei.test'], 'bought in the last 30 days');
select results_eq($$ select * from pg_temp.members('{"not_purchased_days": 90}') $$,
  array['seg.gone@solei.test', 'seg.wa@solei.test'], 'lapsed or never bought');
select results_eq(format($$ select * from pg_temp.members('{"destination_ids": ["%s"]}') $$, :'capri_dest'),
  array['seg.big@solei.test'], 'bought a Capri scent');
select results_eq($$ select * from pg_temp.members('{"emirates": ["abu_dhabi"]}') $$,
  array['seg.gone@solei.test', 'seg.wa@solei.test'], 'by emirate');
select results_eq($$ select * from pg_temp.members('{"consent": "opted_in"}') $$,
  array['seg.big@solei.test', 'seg.wa@solei.test'], 'agreed to marketing');
select results_eq($$ select email from public.segment_members('{}') where email like 'seg.%' and emailable order by email $$,
  array['seg.big@solei.test'], 'only email opt-ins (not unsubscribed, not WhatsApp-only) can get campaigns');

reset role;
insert into public.passports (customer_id, how) values (:'wa', 'manual');
select tests.login_as((select user_id from public.staff_profiles where email = 'seg-owner@solei.test'));
select results_eq($$ select * from pg_temp.members('{"passport": "has"}') $$,
  array['seg.wa@solei.test'], 'has a passport');
select results_eq($$ select * from pg_temp.members('{"passport": "none"}') $$,
  array['seg.big@solei.test', 'seg.gone@solei.test'], 'no passport');

-- Unsubscribe (service role) and permissions.
reset role;
select public.customer_unsubscribe(:'big');
select is((select marketing_consent from public.customers where id = :'big'), false, 'unsubscribe turns consent off');
select tests.login_as(tests.create_staff('seg-sales@solei.test', 'sales_staff'));
select throws_ok($$ select * from public.segment_members('{}') $$, '42501', null, 'sales staff cannot list segments');

select * from finish();
rollback;
