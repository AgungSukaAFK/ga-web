-- 0017_announcer_tts.sql
--
-- Batas pemakaian Google Cloud Text-to-Speech untuk Announcer Follow-up
-- (app/api/announcer/tts/route.ts). Jumlah karakter yang dikirim ke Google
-- dicatat per hari; kalau melewati batas harian ATAU bulanan
-- (GOOGLE_TTS_DAILY_CHAR_LIMIT / GOOGLE_TTS_MONTHLY_CHAR_LIMIT di server),
-- API menolak & PC announcer memakai suara cadangan (browser) sampai kuota
-- tersedia lagi. Sisa kuota ditampilkan di halaman /announcer.
--
-- Catatan: yang dihitung cuma karakter yang dikirim aplikasi ini. Batas
-- kuota di GCP Console tetap pengaman utama.
--
-- Hari/bulan dihitung dari current_date database (UTC, reset jam 07.00 WIB).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0016_followup_announcer.sql. Script IDEMPOTENT.

create table if not exists public.announcer_tts_usage (
  day date primary key,
  chars integer not null default 0,
  requests integer not null default 0
);

-- Tanpa policy: cuma service role (API route) yang mengakses.
alter table public.announcer_tts_usage enable row level security;

-- Pemakaian hari ini & bulan ini.
create or replace function public.get_announcer_tts_usage()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'today', coalesce(sum(chars) filter (where day = current_date), 0),
    'month', coalesce(sum(chars), 0)
  )
  from public.announcer_tts_usage
  where day >= date_trunc('month', current_date)::date;
$$;

-- Catat pemakaian kalau masih di bawah batas harian & bulanan.
-- Return { ok, reason ('daily_limit' | 'monthly_limit' | null), today, month }
-- - today/month = pemakaian SETELAH pencatatan ini (kalau ok).
create or replace function public.consume_announcer_tts_chars(
  p_chars integer,
  p_daily_limit integer,
  p_monthly_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage jsonb;
  v_today integer;
  v_month integer;
begin
  -- Request bersamaan dari beberapa PC announcer diproses bergiliran supaya
  -- batasnya tidak kebobolan.
  perform pg_advisory_xact_lock(hashtext('announcer_tts_usage'));

  v_usage := public.get_announcer_tts_usage();
  v_today := (v_usage ->> 'today')::integer;
  v_month := (v_usage ->> 'month')::integer;

  if v_today + p_chars > p_daily_limit then
    return v_usage || jsonb_build_object('ok', false, 'reason', 'daily_limit');
  end if;
  if v_month + p_chars > p_monthly_limit then
    return v_usage || jsonb_build_object('ok', false, 'reason', 'monthly_limit');
  end if;

  insert into public.announcer_tts_usage as u (day, chars, requests)
  values (current_date, p_chars, 1)
  on conflict (day) do update
    set chars = u.chars + excluded.chars,
        requests = u.requests + 1;

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'today', v_today + p_chars,
    'month', v_month + p_chars
  );
end;
$$;

revoke execute on function public.get_announcer_tts_usage()
  from public, anon, authenticated;
grant execute on function public.get_announcer_tts_usage() to service_role;

revoke execute on function public.consume_announcer_tts_chars(integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_announcer_tts_chars(integer, integer, integer)
  to service_role;
