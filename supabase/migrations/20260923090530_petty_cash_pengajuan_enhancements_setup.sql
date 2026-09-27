-- Tambah kolom ke petty_cash_pengajuan untuk:
--  - week_of_month: minggu ke berapa (di bulan submit) dana ini dibutuhkan -
--    diisi Input Pengajuan (lihat lib/weekOfMonth.ts), null utk baris lama.
--  - site: snapshot profiles.lokasi requester PAS submit (sama perlakuannya
--    dengan department/company yang juga di-snapshot, bukan di-join live).
--  - revisions: riwayat versi sebelum tiap "Edit & Setujui" approver (lihat
--    PcDocumentRevision, type/index.ts & buildEditAndApproveUpdate,
--    lib/pcApprovalFlow.ts) - array kosong = belum pernah direvisi.
--
-- Tidak perlu policy RLS baru - petty_cash_pengajuan_update_approver
-- (petty-cash-pengajuan-approval-setup.sql) sudah `with check (true)`,
-- approver yang gilirannya pending sudah boleh update kolom apa pun
-- termasuk kolom-kolom baru ini.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-pengajuan-setup.sql & petty-cash-pengajuan-approval-setup.sql.

alter table public.petty_cash_pengajuan
  add column if not exists week_of_month int,
  add column if not exists site text,
  add column if not exists revisions jsonb not null default '[]';
