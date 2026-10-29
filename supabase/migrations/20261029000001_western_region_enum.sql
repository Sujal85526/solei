-- Western Region (Al Dhafra: Ruwais, Madinat Zayed, Liwa …) as its own delivery area.
-- A new enum value can't be used in the transaction that adds it, so the delivery zone row
-- lives in the next migration.
alter type public.emirate add value if not exists 'western_region';
