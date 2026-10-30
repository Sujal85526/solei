-- Let the staff order form and order tracking accept the new channel. These two functions are edited
-- in place, not retyped, so whichever version is installed keeps everything else. Safe to run again.
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
