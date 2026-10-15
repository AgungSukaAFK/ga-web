-- Kembalikan kolom "category" (kategori umum, single) pada master barang
-- MR/PO (public.barang). Klasifikasi COA GMI/GIS (coa_gmi & coa_gis, lihat
-- 20260926150000_barang_coa_setup.sql) ternyata hanya berlaku utk barang
-- Petty Cash (public.petty_cash_barang.coa) - TIDAK utk katalog MR/PO.
--
-- Data dikembalikan dari coa_gmi (tempat data category lama dipindah);
-- kalau coa_gmi kosong tapi coa_gis sempat diisi, pakai coa_gis.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

alter table public.barang
  add column if not exists category text;

update public.barang
  set category = coalesce(nullif(trim(coa_gmi), ''), nullif(trim(coa_gis), ''))
  where category is null;

alter table public.barang
  drop column if exists coa_gmi,
  drop column if exists coa_gis;
