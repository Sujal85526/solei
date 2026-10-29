-- Calendar: a "Wedding" event type (alongside exhibition, pop-up, private booking, other). Alone in
-- its file: a new enum value can't be used in the transaction that adds it. Safe for `main`, which
-- never sends it and shows unknown types as they are.
alter type public.event_type add value if not exists 'wedding' before 'other';
