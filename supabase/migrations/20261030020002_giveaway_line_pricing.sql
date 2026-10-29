-- Giveaway lines: price and check a line that is a real bottle bought through a giveaway product.
-- The 3-argument versions take the giveaway (or null for an ordinary line); the 2-argument versions
-- from 20261024000010 keep working and delegate with null.
--
-- With a giveaway: the variant must be one of its active bottles (giveaway_items), the price is the
-- bottle's giveaway price (or the variant price) plus the chosen options of the GIVEAWAY's groups,
-- and the snapshot starts with { group: 'Giveaway', choices: [{ label: <giveaway name> }] } so every
-- order page and email shows it without changes.

create or replace function public.line_unit_price_fils(p_variant uuid, p_options jsonb, p_giveaway uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(gi.price_fils, v.price_fils) + coalesce((
    select sum(o.price_delta_fils)::int
      from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) c
      cross join lateral jsonb_array_elements_text(coalesce(c -> 'option_ids', '[]'::jsonb)) oid
      join product_options o on o.id = oid::uuid and o.active
      join product_option_groups g on g.id = o.group_id and g.product_id = coalesce(p_giveaway, v.product_id)
                                  and g.id = (c ->> 'group_id')::uuid
  ), 0)
  from product_variants v
  left join giveaway_items gi on gi.product_id = p_giveaway and gi.variant_id = v.id and gi.active
  where v.id = p_variant;
$$;

create or replace function public.line_unit_price_fils(p_variant uuid, p_options jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.line_unit_price_fils(p_variant, p_options, null::uuid);
$$;

create or replace function public.line_options_check(p_variant uuid, p_options jsonb, p_giveaway uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_product uuid;
  v_name text;
  grp record;
  c jsonb;
  v_ids uuid[];
  v_valid int;
  v_text text;
  v_snapshot jsonb := '[]'::jsonb;
begin
  if p_giveaway is null then
    select p.id, p.name into v_product, v_name
      from product_variants v join products p on p.id = v.product_id where v.id = p_variant;
    if v_product is null then
      return jsonb_build_object('ok', false, 'error', 'a product in your cart is no longer available');
    end if;
  else
    select p.id, p.name into v_product, v_name
      from products p where p.id = p_giveaway and p.is_giveaway and p.active;
    if v_product is null then
      return jsonb_build_object('ok', false, 'error', 'a giveaway in your cart is no longer available');
    end if;
    if not exists (select 1 from giveaway_items gi
                     join product_variants v on v.id = gi.variant_id and v.active
                     join products pr on pr.id = v.product_id and pr.active
                    where gi.product_id = p_giveaway and gi.variant_id = p_variant and gi.active) then
      return jsonb_build_object('ok', false, 'error', format('%s: a scent you chose is no longer offered — please choose again', v_name));
    end if;
    v_snapshot := jsonb_build_array(jsonb_build_object(
      'group', 'Giveaway', 'kind', 'single', 'text', null,
      'choices', jsonb_build_array(jsonb_build_object('label', v_name, 'price_delta_fils', 0))));
  end if;

  if exists (select 1 from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) x
              where not exists (select 1 from product_option_groups g
                                 where g.id = (x ->> 'group_id')::uuid and g.product_id = v_product)) then
    return jsonb_build_object('ok', false, 'error', format('the options for %s changed — please choose again', v_name));
  end if;

  for grp in select * from product_option_groups where product_id = v_product order by sort, created_at loop
    c := null;
    select x into c from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) x
     where (x ->> 'group_id')::uuid = grp.id limit 1;
    if grp.kind = 'text' then
      v_text := nullif(trim(coalesce(c ->> 'text', '')), '');
      if v_text is null and grp.required then
        return jsonb_build_object('ok', false, 'error', format('%s: please fill in “%s”', v_name, grp.name));
      end if;
      if v_text is not null and length(v_text) > grp.max_length then
        return jsonb_build_object('ok', false, 'error', format('%s: “%s” is too long', v_name, grp.name));
      end if;
      if v_text is not null then
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
          'group', grp.name, 'kind', grp.kind, 'choices', '[]'::jsonb, 'text', v_text));
      end if;
    else
      select coalesce(array_agg(distinct x::uuid), '{}') into v_ids
        from jsonb_array_elements_text(coalesce(c -> 'option_ids', '[]'::jsonb)) x;
      select count(*) into v_valid from product_options o
       where o.group_id = grp.id and o.active and o.id = any (v_ids);
      if v_valid <> cardinality(v_ids) then
        return jsonb_build_object('ok', false, 'error', format('%s: an option is no longer available — please choose again', v_name));
      end if;
      if (grp.kind = 'single' and (cardinality(v_ids) > 1 or (grp.required and cardinality(v_ids) = 0)))
         or (grp.kind = 'multi' and grp.required and cardinality(v_ids) = 0) then
        return jsonb_build_object('ok', false, 'error', format('%s: please choose “%s”', v_name, grp.name));
      end if;
      if cardinality(v_ids) > 0 then
        v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
          'group', grp.name, 'kind', grp.kind, 'text', null,
          'choices', (select jsonb_agg(jsonb_build_object('label', o.label, 'price_delta_fils', o.price_delta_fils)
                                       order by o.sort, o.label)
                        from product_options o where o.id = any (v_ids))));
      end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true,
    'snapshot', case when jsonb_array_length(v_snapshot) = 0 then null else v_snapshot end);
end;
$$;

create or replace function public.line_options_check(p_variant uuid, p_options jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.line_options_check(p_variant, p_options, null::uuid);
$$;

revoke all on function public.line_unit_price_fils(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.line_options_check(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.line_unit_price_fils(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.line_options_check(uuid, jsonb) from public, anon, authenticated;
