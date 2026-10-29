-- Welcome email for a website sign-up, sent once when the new account's email is verified.
-- Owner-editable like every other template. {{stamps_line}} shows any stickers already on their
-- record (e.g. added by the team for earlier Instagram / WhatsApp orders).
insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort)
values (
  'account_welcome', 'customer', 'Welcome (new account)',
  'Sent once when someone creates an account on the website and verifies their email.',
  'Welcome to Solei',
  E'Dear {{customer_name}},\n\nWelcome to Solei — your account is ready. Order your favourite fragrances any time at [soleiperfumes.com]({{shop_link}}).\n\n{{stamps_line}}\n\nYour Solei Passport is where your stickers live — collect {{stamps_for_reward}} and {{reward}} is yours.\n\n[Open your passport]({{passport_link}})\n\nMade to remain,\nSolei',
  array['customer_name','stamps','stamps_for_reward','remaining','reward','stamps_line','shop_link','passport_link'],
  115
)
on conflict (key) do nothing;
