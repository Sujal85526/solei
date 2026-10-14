-- Custom role keys are derived from the name and may contain digits ("event_lead_2").
alter table public.roles drop constraint roles_key_check;
alter table public.roles add constraint roles_key_check check (key ~ '^[a-z][a-z0-9_]*$');
