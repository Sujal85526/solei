-- Phase 2 points: spending points is a payment method. Own migration because a new enum value
-- can't be used in the transaction that adds it (20261024000009 uses it).
alter type public.payment_method add value if not exists 'loyalty_points';
