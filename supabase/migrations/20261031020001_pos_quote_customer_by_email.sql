/*
  Till quote: find the customer by email too, not only by mobile. A cashier who typed only the
  customer's email saw "Add the customer's mobile or email above to use their points or a VIP code"
  and couldn't use points, rewards or VIP codes, although the sale itself (pos_sale →
  upsert_customer) links the customer by that email. The match mirrors upsert_customer, so the quote
  finds the same customer the sale will be recorded against: by mobile first, then by email into a
  record without a different mobile.
*/
create or replace function public.pos_quote(p jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_phone text := nullif(trim(p ->> 'customer_phone'), '');
  v_email text := nullif(lower(trim(p ->> 'customer_email')), '');
begin
  perform public.require_permission('pos.use');
  if v_customer is null and v_phone is not null then
    select id into v_customer from customers where phone = v_phone;
  end if;
  if v_customer is null and v_email is not null then
    select id into v_customer from customers
    where email = v_email and (phone is null or phone = v_phone)
    order by created_at limit 1;
  end if;
  if v_email is null and v_customer is not null then
    select email into v_email from customers where id = v_customer;
  end if;
  return public.promo_price(p -> 'lines', coalesce(p -> 'coupon_codes', '[]'::jsonb),
    jsonb_build_object('channel', 'pos', 'event_id', p ->> 'event_id', 'email', v_email,
                       'customer_id', v_customer)) ||
    jsonb_build_object('customer_id', v_customer,
      'points_balance', case when v_customer is not null then public.points_balance(v_customer) end);
end;
$$;
revoke all on function public.pos_quote(jsonb) from public, anon;
grant execute on function public.pos_quote(jsonb) to authenticated;
