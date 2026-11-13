-- 0027_realtime_mr_po.sql
--
-- Aktifkan Supabase Realtime (postgres_changes) untuk material_requests &
-- purchase_orders. Dipakai halaman Approval & Validation supaya antrian
-- langsung ikut berubah begitu MR/PO divalidasi / di-approve / ditolak di tab
-- atau oleh user lain, tanpa perlu refresh manual.
--
-- Event tetap tunduk RLS SELECT tabelnya, jadi user hanya menerima perubahan
-- baris yang memang boleh dia baca. Halaman cuma memakai event sebagai
-- pemicu fetch ulang (isi payload tidak dibaca), jadi tidak perlu
-- REPLICA IDENTITY FULL.

do $$
begin
  alter publication supabase_realtime add table public.material_requests;
exception
  when duplicate_object then null;
  when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.purchase_orders;
exception
  when duplicate_object then null;
  when others then null;
end $$;
