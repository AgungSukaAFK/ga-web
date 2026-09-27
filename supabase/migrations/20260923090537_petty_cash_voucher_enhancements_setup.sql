-- Tambah kolom ke petty_cash_voucher untuk:
--  - week_of_month / site: disalin dari Pengajuan asalnya saat Voucher
--    dibuat (lihat createVoucherFromPengajuan,
--    services/pettyCashVoucherService.ts) - informasional, cuma bisa
--    berubah lagi lewat "Edit & Setujui" approver Voucher.
--  - revisions: riwayat versi sebelum tiap "Edit & Setujui" approver Voucher
--    (lihat PcDocumentRevision, type/index.ts & buildEditAndApproveUpdate,
--    lib/pcApprovalFlow.ts).
--
-- Tidak perlu policy RLS baru - petty_cash_voucher_update_approver
-- (petty-cash-voucher-setup.sql) sudah `with check (true)`.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-voucher-setup.sql.

alter table public.petty_cash_voucher
  add column if not exists week_of_month int,
  add column if not exists site text,
  add column if not exists revisions jsonb not null default '[]';
