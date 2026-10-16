-- Client contact details (2026-10-16): WhatsApp 050 470 8053, support email soleiperfumes@gmail.com,
-- Instagram @solei.ad. Shown on Contact us and the footer; filled into the policies where the
-- handover had [BUSINESS EMAIL] / [BUSINESS WHATSAPP] / [PRIVACY EMAIL]; owner alerts go to the same inbox.
update public.settings
   set contact_email = 'soleiperfumes@gmail.com',
       whatsapp_number = '+971504708053',
       instagram_handle = '@solei.ad',
       instagram_url = 'https://www.instagram.com/solei.ad/'
 where id = 1;

update public.private_settings
   set owner_notification_email = coalesce(owner_notification_email, 'soleiperfumes@gmail.com')
 where id = 1;

update public.help_topics
   set body = replace(body,
     'For delivery questions, contact us through our Contact us page. Include your order reference.',
     'For delivery questions, contact us at soleiperfumes@gmail.com or on WhatsApp at 050 470 8053. Include your order reference.')
 where slug = 'shipping';

update public.help_topics
   set body = replace(body,
     'Customers can contact us through our Contact us page to ask about personal data',
     'Customers can contact soleiperfumes@gmail.com to ask about personal data')
 where slug = 'privacy';
