-- ============================================================================
--  NOTIFICATIONS SETUP  (jalankan SEKALI di Supabase → SQL Editor)
-- ----------------------------------------------------------------------------
--  Memperbaiki 2 akar masalah kenapa notifikasi selalu kosong:
--    1. RLS memblokir INSERT  → kita pakai RPC SECURITY DEFINER, bukan insert
--       langsung dari client. User tidak bisa membuat notif palsu atas nama
--       orang lain (actor_id selalu dipaksa = user yang sedang login).
--    2. Kolom resource_id bertipe uuid, padahal id MR/PO/PC adalah bigint
--       → kita ubah ke text supaya bisa menampung id apa pun.
--
--  Juga: mengaktifkan Realtime + memastikan policy SELECT/UPDATE benar.
--  Script ini IDEMPOTENT (aman dijalankan berulang).
-- ============================================================================

-- 1) resource_id: uuid -> text (id MR/PO/PC adalah bigint, bukan uuid) -------
alter table public.notifications
  alter column resource_id type text using resource_id::text;

-- 2) Pastikan RLS aktif -------------------------------------------------------
alter table public.notifications enable row level security;

-- 3) Policy SELECT: user hanya bisa melihat notif miliknya -------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 4) Policy UPDATE: user hanya bisa update notif miliknya (tandai dibaca) ----
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- CATATAN: TIDAK ADA policy INSERT. Semua pembuatan notif HARUS lewat fungsi
-- create_notifications() di bawah (SECURITY DEFINER), supaya aman & terpusat.

-- 5) Fungsi pembuat notifikasi (dipanggil dari aplikasi via rpc) -------------
--    Input: array JSON, tiap elemen = 1 notif untuk 1 penerima.
--    Contoh elemen:
--    { "user_id": "...", "type": "mr_submitted", "title": "...",
--      "message": "...", "link": "/material-request/123",
--      "resource_id": "123", "resource_type": "material_request" }
create or replace function public.create_notifications(p_notifications jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_notifications is null
     or jsonb_typeof(p_notifications) <> 'array' then
    return 0;
  end if;

  insert into public.notifications
    (user_id, actor_id, type, title, message, link,
     resource_id, resource_type, is_read)
  select
    (elem->>'user_id')::uuid,
    v_actor,                                  -- actor selalu = pemanggil (anti-spoof)
    elem->>'type',
    elem->>'title',
    nullif(elem->>'message', ''),
    elem->>'link',
    nullif(elem->>'resource_id', ''),
    nullif(elem->>'resource_type', ''),
    false
  from jsonb_array_elements(p_notifications) as elem
  where coalesce(elem->>'user_id', '') <> ''   -- lewati penerima kosong
    and (elem->>'user_id')::uuid <> v_actor;    -- jangan notif diri sendiri

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Hanya user terautentikasi yang boleh memanggil fungsi ini ------------------
revoke all on function public.create_notifications(jsonb) from public;
grant execute on function public.create_notifications(jsonb) to authenticated;

-- 6) Aktifkan Realtime untuk tabel notifications -----------------------------
--    (abaikan error "already member" bila sudah pernah ditambahkan)
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- ============================================================================
--  SELESAI. Cara cepat tes dari SQL Editor (ganti <UUID_USER_ANDA>):
--    select public.create_notifications(
--      jsonb_build_array(jsonb_build_object(
--        'user_id','<UUID_USER_ANDA>', 'type','info',
--        'title','Tes Notifikasi', 'message','Halo dunia',
--        'link','/notifications'
--      ))
--    );
--  Lalu cek: select * from public.notifications order by created_at desc;
-- ============================================================================
