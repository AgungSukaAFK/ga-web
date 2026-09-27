-- Fitur "Follow-up Approval" - tombol di jalur approval MR/PO yang cuma
-- ngirim notifikasi nudge ke approver yang lagi jadi penentu (blocking),
-- TIDAK mengubah status approval-nya. Riwayat siapa-minta-ke-siapa-kapan
-- disimpan sebagai array (bukan ditimpa) di kolom baru ini, dipakai untuk:
--   1. Dialog konfirmasi di detail MR/PO ("sudah pernah follow-up X yang lalu,
--      follow-up lagi?").
--   2. Panel "Follow-up Approval" di dashboard approver yang di-tag, dikelompokkan
--      per dokumen dan otomatis hilang begitu approver-nya sudah approve/reject
--      (dihitung dari kolom `approvals` yang sudah ada, bukan kolom ini).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

alter table public.material_requests
  add column if not exists followup_requests jsonb not null default '[]'::jsonb;

alter table public.purchase_orders
  add column if not exists followup_requests jsonb not null default '[]'::jsonb;
