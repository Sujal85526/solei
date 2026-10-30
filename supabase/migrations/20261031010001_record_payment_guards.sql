-- record_payment: restore the guards that 20261014000015 dropped when it redefined the function.
--   1. Only hand-taken methods. Online card / Apple Pay / payment link are recorded by the verified
--      webhook; gift cards and loyalty points by their own RPCs (which also deduct the balance).
--   2. Lock the order row so two staff recording at once can't overpay it.
--   3. Write the audit row.
-- Same signature and return type; the app already allows only cash/card_terminal/soft_pos/
-- bank_transfer/other (MANUAL_PAYMENT_METHODS).

create or replace function public.record_payment(
  p_order_id uuid,
  p_amount_fils int,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null
)
returns table (payment_id uuid, newly_paid boolean, outstanding_fils int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment_id uuid;
  v_outstanding int;
begin
  perform public.require_permission('payments.record');
  if p_amount_fils is null or p_amount_fils <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;
  if p_method not in ('cash', 'card_terminal', 'soft_pos', 'bank_transfer', 'other') then
    raise exception 'this payment method is recorded automatically' using errcode = '22023';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  if v_order.status = 'cancelled' then raise exception 'order is cancelled' using errcode = 'P0001'; end if;

  select s.outstanding_fils into v_outstanding from order_payment_summary s where s.order_id = p_order_id;
  if p_amount_fils > v_outstanding then
    raise exception 'amount is more than the outstanding %', v_outstanding using errcode = 'P0001';
  end if;

  insert into payments (order_id, kind, amount_fils, method, status, reference, note, received_by, received_at)
  values (p_order_id, 'payment', p_amount_fils, p_method, 'succeeded', nullif(trim(p_reference), ''),
          nullif(trim(p_note), ''), auth.uid(), now())
  returning id into v_payment_id;

  v_outstanding := v_outstanding - p_amount_fils;
  perform public.write_audit('payment.recorded', 'payments', v_payment_id::text, null,
    jsonb_build_object('order', v_order.number, 'amount_fils', p_amount_fils, 'method', p_method,
                       'outstanding_fils', v_outstanding));

  return query select v_payment_id, public.settle_if_paid(p_order_id), v_outstanding;
end;
$$;
