-- Staff reminders (shifts, events) are templates "to staff". Own migration: a new enum value can't
-- be used in the transaction that adds it. main's Settings → Notifications lists templates by
-- audience (customer, owner), so staff templates simply don't show there until the merge.
alter type public.notification_audience add value if not exists 'staff';
