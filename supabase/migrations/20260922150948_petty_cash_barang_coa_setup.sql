-- Tambah kolom COA (company: GMI/GIS) ke katalog Barang Petty Cash - dipakai
-- utk membatasi barang apa yang muncul di combobox pencarian saat submit
-- Input Pengajuan (user non-Lourdes cuma lihat barang yang coa-nya memuat
-- company dia sendiri; Lourdes lihat semua - lihat searchPettyCashBarang,
-- services/pettyCashBarangService.ts). Halaman kelola katalog (Barang Petty
-- Cash) SENGAJA TIDAK dibatasi kolom ini - GA/Admin tetap kelola semua
-- barang apa pun company mereka sendiri.
--
-- Default '{GMI,GIS}' (bukan array kosong) supaya SEMUA barang lama tetap
-- kelihatan sama seperti sebelum migrasi ini (baik company) - GA baru
-- mempersempit COA per barang belakangan lewat form edit kalau perlu.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-barang-setup.sql.

alter table public.petty_cash_barang
  add column if not exists coa text[] not null default '{GMI,GIS}';

alter table public.petty_cash_barang
  drop constraint if exists petty_cash_barang_coa_check;
alter table public.petty_cash_barang
  add constraint petty_cash_barang_coa_check
  check (coa <@ array['GMI', 'GIS']::text[]);
