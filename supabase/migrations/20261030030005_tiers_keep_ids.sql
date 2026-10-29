-- VIP tiers keep their ids when the owner saves the tiers form, so codes for a tier
-- (coupons.tier_ids) and early access (products.early_access_tier_ids) keep pointing at them.
-- Tiers are matched by position (lowest spend first): renaming or re-pricing a tier keeps it; extra
-- rows are added, missing ones removed (and taken out of codes and products). Same signature as
-- 20261024000009.
create or replace function public.loyalty_tiers_save(p jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  v_old uuid[];
  v_gone uuid[];
  r record;
begin
  perform public.require_permission('loyalty.manage');
  n := jsonb_array_length(coalesce(p, '[]'::jsonb));
  if n < 1 or n > 6 then raise exception 'between 1 and 6 tiers' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(p) t where (t ->> 'min_spend_fils')::int = 0) then
    raise exception 'the first tier must start at AED 0' using errcode = '22023';
  end if;
  if (select count(distinct (t ->> 'min_spend_fils')::int) from jsonb_array_elements(p) t) <> n then
    raise exception 'two tiers have the same spend' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(id order by min_spend_fils), '{}') into v_old from loyalty_tiers;
  v_gone := v_old[n + 1:];
  delete from loyalty_tiers where id = any (v_gone);
  -- Move the kept tiers out of the way of the unique spend index, then set the new values.
  update loyalty_tiers set min_spend_fils = min_spend_fils + 1000000000 where id = any (v_old);
  for r in
    select x, row_number() over (order by (x ->> 'min_spend_fils')::int)::int as i
      from jsonb_array_elements(p) x
  loop
    if r.i <= cardinality(v_old) then
      update loyalty_tiers
         set name = trim(r.x ->> 'name'), min_spend_fils = (r.x ->> 'min_spend_fils')::int,
             points_multiplier_bp = (r.x ->> 'points_multiplier_bp')::int,
             perks = nullif(trim(r.x ->> 'perks'), '')
       where id = v_old[r.i];
    else
      insert into loyalty_tiers (name, min_spend_fils, points_multiplier_bp, perks)
      values (trim(r.x ->> 'name'), (r.x ->> 'min_spend_fils')::int, (r.x ->> 'points_multiplier_bp')::int,
              nullif(trim(r.x ->> 'perks'), ''));
    end if;
  end loop;

  if cardinality(v_gone) > 0 then
    update coupons set tier_ids = array(select x from unnest(tier_ids) x where not (x = any (v_gone)))
     where tier_ids && v_gone;
    update products set early_access_tier_ids =
           array(select x from unnest(early_access_tier_ids) x where not (x = any (v_gone)))
     where early_access_tier_ids && v_gone;
  end if;
  return n;
end;
$$;
