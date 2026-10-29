-- One-off "welcome to the website" email for customers the team entered by hand (past Instagram /
-- WhatsApp buyers). Sent from the customer page; owner-editable like every other template.
-- {{stamps_line}} is a ready-made sentence that changes with the customer's sticker count.
insert into public.notification_templates (key, audience, name, description, subject, body, variables, sort)
values (
  'customer_welcome', 'customer', 'Welcome to the website',
  'Sent by staff to customers added by hand, so they can order online and claim their stickers.',
  'Welcome to the new Solei website',
  E'Dear {{customer_name}},\n\nThank you for being one of our first Solei customers — and welcome to our new website. You can now order your favourite fragrances online, any time, at [soleiperfumes.com]({{shop_link}}).\n\n{{stamps_line}}\n\nYour Solei Passport is waiting for you. Create an account with this email address ({{customer_email}}) and your stickers will appear automatically.\n\n[Open your passport]({{passport_link}})\n\nMade to remain,\nSolei',
  array['customer_name','customer_email','stamps','stamps_for_reward','remaining','reward','stamps_line','shop_link','passport_link'],
  110
)
on conflict (key) do nothing;
