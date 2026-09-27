-- Tambah kolom ke petty_cash_deklarasi untuk:
--  - week_of_month / site: disalin berantai dari Voucher (yang disalin dari
--    Pengajuan) saat Deklarasi dibuat (lihat createDeklarasiFromVoucher,
--    services/pettyCashDeklarasiService.ts) - informasional saja, Deklarasi
--    sendiri tidak punya konsep "kapan dibutuhkan" lagi (tahap laporan
--    pemakaian riil).
--  - revisions: riwayat versi sebelum tiap "Edit & Setujui" approver
--    Deklarasi (lihat PcDocumentRevision, type/index.ts &
--    buildEditAndApproveUpdate, lib/pcApprovalFlow.ts).
--
-- Tidak perlu policy RLS baru - petty_cash_deklarasi_update_approver
-- (petty-cash-deklarasi-setup.sql) sudah `with check (true)`.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-deklarasi-setup.sql.

alter table public.petty_cash_deklarasi
  add column if not exists week_of_month int,
  add column if not exists site text,
  add column if not exists revisions jsonb not null default '[]';
