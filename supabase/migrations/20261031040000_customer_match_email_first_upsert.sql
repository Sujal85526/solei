/*
  One customer per email: a sale with an email goes to the customer with that email, even when their
  mobile on file is missing or different. Before, an email without the matching mobile created a second
  record; its stickers never reached the online account, which links to one record by verified email
  (link_customer_account). Without an email match, the mobile decides, so phone-only customers keep working.
  Details on file are never overwritten, only blanks filled; a mobile that belongs to someone else is
  left where it is (customers.phone is unique).
*/
create or replace function public.upsert_customer(
  p_phone text,
  p_email text,
  p_name text default null,
  p_source public.customer_source default 'manual',
  p_emirate public.emirate default null,
  p_address jsonb default null,
  p_marketing_consent boolean default false,
  p_marketing_channel text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
begin
  if v_phone is null and v_email is null then
    raise exception 'phone or email is required' using errcode = '22023';
  end if;

  if v_email is not null then
    select id into v_id from customers where email = v_email order by created_at limit 1;
  end if;
  if v_id is null and v_phone is not null then
    select id into v_id from customers where phone = v_phone;
  end if;

  if v_id is null then
    insert into customers (name, phone, email, emirate, address, source,
                           marketing_consent, marketing_consent_at, marketing_channels)
    values (nullif(trim(p_name), ''), v_phone, v_email, p_emirate, p_address, p_source,
            p_marketing_consent, case when p_marketing_consent then now() end,
            case when p_marketing_consent and p_marketing_channel is not null then array[p_marketing_channel] else '{}' end)
    returning id into v_id;
  else
    update customers set
      name = coalesce(name, nullif(trim(p_name), '')),
      phone = coalesce(phone, case when not exists (select 1 from customers o where o.phone = v_phone) then v_phone end),
      email = coalesce(email, v_email),
      emirate = coalesce(p_emirate, emirate),
      address = coalesce(p_address, address),
      marketing_consent = marketing_consent or p_marketing_consent,
      marketing_consent_at = case when p_marketing_consent then now() else marketing_consent_at end,
      unsubscribed_at = case when p_marketing_consent then null else unsubscribed_at end,
      marketing_channels = case
        when p_marketing_consent and p_marketing_channel is not null
             and not (p_marketing_channel = any (marketing_channels))
        then marketing_channels || p_marketing_channel
        else marketing_channels end
    where id = v_id;
  end if;
  return v_id;
end;
$$;
