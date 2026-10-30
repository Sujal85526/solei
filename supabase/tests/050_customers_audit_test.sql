begin;
-- One snapshot for the whole file: the test DB is shared, so rows others commit mid-run stay out of the checks.
set transaction isolation level repeatable read;
\ir helpers/setup.psql
select plan(12);

-- Phones nobody has yet (the test DB is shared, so fixed numbers can already belong to someone).
select p as phone1 from (select format('+97150%s', lpad((floor(random() * 1e7))::int::text, 7, '0')) p
  from generate_series(1, 50)) x where not exists (select 1 from public.customers c where c.phone = x.p) limit 1 \gset
select p as phone2 from (select format('+97155%s', lpad((floor(random() * 1e7))::int::text, 7, '0')) p
  from generate_series(1, 50)) x where not exists (select 1 from public.customers c where c.phone = x.p) limit 1 \gset

select public.upsert_customer(:'phone1', null, 'Layla', 'pos') as c1 \gset
select is(public.upsert_customer(:'phone1', 'Layla@Example.com', 'Layla A', 'website'), :'c1'::uuid, 'same phone → same customer');
select is((select email from public.customers where id = :'c1'), 'layla@example.com', 'email added and lower-cased');
select is((select name from public.customers where id = :'c1'), 'Layla', 'existing name is not overwritten');

select tests.login_anon();
select lives_ok(format($$ select public.marketing_opt_in('whatsapp', null, %L) $$, :'phone2'), 'anon can opt in');
select tests.logout();
select ok((select marketing_consent and marketing_consent_at is not null and 'whatsapp' = any (marketing_channels)
           from public.customers where phone = :'phone2'), 'consent stored with timestamp and channel');

select tests.create_staff('owner@test.solei', 'owner') as owner_id \gset
select tests.login_as(:'owner_id');
update public.product_variants set price_fils = 29000 where sku = 'TST-P-CAN-50';
select tests.logout();
select is((select actor_id from public.audit_log where entity = 'product_variants' and action = 'product_variants.update' order by id desc limit 1),
  :'owner_id'::uuid, 'price change is audited with the actor');
select is((select (before ->> 'price_fils')::int || '→' || (after ->> 'price_fils') from public.audit_log
           where entity = 'product_variants' order by id desc limit 1), '28000→29000', 'audit keeps before/after');

-- One customer per email: the email decides, the mobile is the backup, nothing on file is overwritten.
reset role;
insert into public.customers (name, phone, email) values ('Match A', '+971501119001', 'match.a@solei.test') returning id as ma \gset
insert into public.customers (name, phone) values ('Match B', '+971501119002') returning id as mb \gset
select is(public.upsert_customer(null, 'Match.A@solei.test'), :'ma'::uuid, 'email alone finds a customer who also has a mobile');
select is(public.upsert_customer('+971501119003', 'match.a@solei.test'), :'ma'::uuid, 'the email decides over a different mobile');
select is((select phone from public.customers where id = :'ma'), '+971501119001', 'the mobile on file is kept');
select is(public.upsert_customer('+971501119002', null), :'mb'::uuid, 'no email: the mobile still finds a phone-only customer');
select lives_ok($$ select public.upsert_customer('+971501119002', 'match.a@solei.test') $$,
  'a mobile that belongs to someone else is left alone, not a crash');

select * from finish();
rollback;
