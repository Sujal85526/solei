-- Instagram orders get their own channel (and customer source), beside WhatsApp and Direct.
alter type public.order_channel add value if not exists 'instagram' after 'whatsapp';
alter type public.customer_source add value if not exists 'instagram' after 'whatsapp';
