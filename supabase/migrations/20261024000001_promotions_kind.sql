-- Phase 2 promotions: a "free delivery" code. Own migration because a new enum value can't be used
-- in the transaction that adds it (20261024000002 uses it).
alter type public.coupon_kind add value if not exists 'free_delivery';
