-- Phase 2 promotions, part 2: a "buy X get Y" discount code. Own migration because a new enum value
-- can't be used in the transaction that adds it (20261030030002 uses it).
alter type public.coupon_kind add value if not exists 'buy_x_get_y';
