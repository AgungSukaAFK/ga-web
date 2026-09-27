-- Auth schema dikecualikan dari `supabase db dump` (dikelola terpisah oleh
-- Supabase), jadi trigger auto-create profiles ini di-recreate manual di
-- local berdasarkan definisi asli yang di-query langsung dari production:
--   SELECT pg_get_triggerdef(oid) FROM pg_trigger
--   WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
