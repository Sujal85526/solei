-- Plan your event: the owner's list of occasions, in that order — Wedding, Engagement, Graduation,
-- Ramadan Gathering, Eid Celebration, Family Gathering, Corporate Event, Other. Idempotent and
-- gentle: only rows still named as seeded (case-insensitive) are renamed, missing ones are added,
-- Birthday (not on the list) is switched off rather than deleted (bookings may reference it), and
-- anything the admin added or renamed is left alone.

update public.booking_event_types t set name = r.new_name
  from (values ('ramadan', 'Ramadan Gathering'), ('eid', 'Eid Celebration'),
               ('family gathering', 'Family Gathering'), ('corporate', 'Corporate Event')) r(old_name, new_name)
 where lower(trim(t.name)) = r.old_name
   and not exists (select 1 from public.booking_event_types x
                    where x.id <> t.id and lower(trim(x.name)) = lower(r.new_name));

update public.booking_event_types set active = false where lower(trim(name)) = 'birthday';

insert into public.booking_event_types (name, sort)
select o.name, o.sort
  from (values ('Wedding', 10), ('Engagement', 20), ('Graduation', 30), ('Ramadan Gathering', 40),
               ('Eid Celebration', 50), ('Family Gathering', 60), ('Corporate Event', 70), ('Other', 80)) o(name, sort)
 where not exists (select 1 from public.booking_event_types t where lower(trim(t.name)) = lower(o.name));

update public.booking_event_types t set sort = o.sort
  from (values ('wedding', 10), ('engagement', 20), ('graduation', 30), ('ramadan gathering', 40),
               ('eid celebration', 50), ('family gathering', 60), ('corporate event', 70), ('other', 80)) o(name, sort)
 where lower(trim(t.name)) = o.name;
