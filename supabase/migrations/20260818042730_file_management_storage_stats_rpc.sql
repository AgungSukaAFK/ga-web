-- File Management (admin) - storage size/date lookup.
--
-- Jalankan SEKALI lewat SQL Editor Supabase, di KEDUA project berikut:
--   1. Project Supabase Cloud utama (yang dipakai auth/db + attachment lama)
--   2. Project Supabase VPS self-hosted (VPS_SUPABASE_URL)
--
-- Fungsi ini membaca storage.objects (size & created_at asli tiap file) dalam
-- satu query, dipakai halaman /file-management supaya tidak perlu memanggil
-- storage.list() folder-per-folder (bisa ribuan request kalau file terorganisir
-- per kode_mr/kode_po).

create or replace function public.get_storage_object_stats(p_bucket_id text)
returns table (name text, size bigint, created_at timestamptz)
language sql
security definer
set search_path = storage, public
as $$
  select
    o.name,
    coalesce((o.metadata->>'size')::bigint, 0) as size,
    o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket_id;
$$;

grant execute on function public.get_storage_object_stats(text) to service_role;
