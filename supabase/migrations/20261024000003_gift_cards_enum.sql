-- Phase 2 gift cards: a gift card is a payment method. Own migration because a new enum value
-- can't be used in the transaction that adds it (20261024000004 uses it).
alter type public.payment_method add value if not exists 'gift_card';
