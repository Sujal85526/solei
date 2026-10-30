-- Runs after this branch's own create_manual_order (20261030020003): when phase-2 reaches a database that
-- already has 20261031050002, that older migration runs late and would drop Instagram again.
do $$
declare
  fn regprocedure;
  def text;
begin
  foreach fn in array array['public.create_manual_order(jsonb)'::regprocedure, 'public.track_order(text, text)'::regprocedure] loop
    def := pg_get_functiondef(fn);
    def := replace(def, '''whatsapp'', ''direct''', '''whatsapp'', ''instagram'', ''direct''');
    def := replace(def, 'manual orders are WhatsApp or direct', 'manual orders are WhatsApp, Instagram or direct');
    execute def;
  end loop;
end $$;
