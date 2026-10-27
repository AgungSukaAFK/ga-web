-- 0012_petty_cash_barang_coa_per_company.sql
--
-- Petty Cash: COA barang jadi PER COMPANY. Sebelumnya `coa` (text[]) cuma
-- penanda company mana yang boleh pakai barang (centang GMI/GIS) dan
-- `category` satu kategori untuk semua company - keliru: COA itu sendiri
-- adalah kategorinya, dan tiap company punya COA masing-masing untuk barang
-- yang sama (mis. barang A di GMI "Kebutuhan Dapur", di GIS "Pantry").
--
-- Diganti dua kolom coa_gmi & coa_gis (pola yang sama dengan
-- barang_coa_setup.sql di master barang MR/PO dulu, lihat 0004/0005).
-- Nilainya dipakai sekaligus sbg kategori DAN penanda aktif: NULL = barang
-- tidak muncul di pencarian Input Pengajuan company tsb (lihat
-- searchPettyCashBarang, services/pettyCashBarangService.ts).
--
-- Data lama: category dipindah ke coa_gmi untuk barang yang coa-nya memuat
-- GMI (semua data production saat ini GMI). coa_gis SENGAJA dikosongkan -
-- COA GIS beda dengan GMI, diisi manual oleh GA lewat form edit barang.
-- Barang khusus GIS (coa = {GIS}) category-nya dipindah ke coa_gis.
--
-- Barang yang category-nya kosong jadi nonaktif di kedua company - cek dulu
-- sebelum menjalankan:
--   select id, part_name, coa from public.petty_cash_barang
--   where coalesce(trim(category), '') = '';
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

alter table public.petty_cash_barang
  add column if not exists coa_gmi text,
  add column if not exists coa_gis text;

-- Dibungkus cek kolom supaya aman dijalankan ulang setelah category/coa
-- sudah di-drop di bawah.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'petty_cash_barang'
      and column_name = 'category'
  ) then
    update public.petty_cash_barang
      set coa_gmi = nullif(trim(category), '')
      where coa_gmi is null and 'GMI' = any(coa);

    update public.petty_cash_barang
      set coa_gis = nullif(trim(category), '')
      where coa_gis is null and coa = array['GIS']::text[];
  end if;
end $$;

alter table public.petty_cash_barang
  drop constraint if exists petty_cash_barang_coa_check;

alter table public.petty_cash_barang
  drop column if exists coa,
  drop column if exists category;

-- String kosong disamakan dengan NULL (nonaktif) supaya filter "aktif di
-- company X" cukup `coa_x is not null`.
alter table public.petty_cash_barang
  drop constraint if exists petty_cash_barang_coa_not_blank;
alter table public.petty_cash_barang
  add constraint petty_cash_barang_coa_not_blank
  check (
    (coa_gmi is null or trim(coa_gmi) <> '')
    and (coa_gis is null or trim(coa_gis) <> '')
  );

create index if not exists idx_petty_cash_barang_coa_gmi
  on public.petty_cash_barang (coa_gmi);
create index if not exists idx_petty_cash_barang_coa_gis
  on public.petty_cash_barang (coa_gis);
