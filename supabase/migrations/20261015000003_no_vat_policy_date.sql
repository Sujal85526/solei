-- Client (2026-10-15): not VAT-registered — no VAT charged or shown (owner can set a rate later in
-- settings); policies dated 14 October 2026.
update public.settings set vat_rate_bp = 0 where id = 1;
update public.help_topics set updated_label = '14 October 2026'
 where slug in ('shipping', 'returns', 'terms', 'privacy');
