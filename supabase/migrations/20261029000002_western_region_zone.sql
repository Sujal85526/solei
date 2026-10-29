-- Western Region delivery: AED 50 (5000 fils). Fees stay admin-editable data, not code.
insert into public.delivery_zones (emirate, name, fee_fils, active, sort)
values ('western_region', 'Western Region', 5000, true, 8)
on conflict (emirate) do nothing;
