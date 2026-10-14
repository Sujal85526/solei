begin;
\ir helpers/setup.psql
select plan(10);

select tests.create_staff('owner@test.solei', 'owner') as owner_id \gset
select tests.create_staff('manager@test.solei', 'manager') as manager_id \gset
select tests.create_staff('sales@test.solei', 'sales_staff') as sales_id \gset
select tests.create_staff('former@test.solei', 'sales_staff', false) as former_id \gset

select tests.login_as(:'owner_id', 'aal1');
select is(public.has_permission('orders.view'), false, 'owner without TOTP (aal1) has no permissions');
select tests.login_as(:'owner_id', 'aal2');
select is(public.has_permission('staff.manage'), true, 'owner with TOTP has staff.manage');
select is((select count(*)::int from public.my_permissions()), (select count(*)::int from public.permissions), 'owner has every permission');

select tests.login_as(:'manager_id', 'aal2');
select is(public.has_permission('reports.financial.view'), true, 'manager sees financials');
select is(public.has_permission('staff.manage'), false, 'manager cannot manage staff');

select tests.login_as(:'sales_id', 'aal1');
select is(public.has_permission('pos.use'), true, 'sales staff can use POS without MFA');
select is(public.has_permission('reports.financial.view'), false, 'sales staff cannot see costs or profit');
select is((select count(*)::int from public.variant_costs), 0, 'sales staff read no variant costs');

select tests.login_as(:'former_id', 'aal1');
select is(public.has_permission('pos.use'), false, 'deactivated staff lose access immediately');

select tests.logout();
select tests.login_anon();
select throws_ok($$ select public.require_permission('orders.view') $$, '42501', 'permission denied: orders.view', 'anon is refused');

select * from finish();
rollback;
