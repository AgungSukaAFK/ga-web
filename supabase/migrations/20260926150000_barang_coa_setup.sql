-- Ganti kolom "category" (single, generik) pada master barang (public.barang)
-- jadi dua kolom per company: coa_gmi & coa_gis. Nilainya dipakai sekaligus
-- sbg kategori tampilan DAN sbg penanda aktif: kosong/NULL = barang
-- dianggap NONAKTIF utk company tsb (belum ada COA yg di-assign di company
-- itu).
--
-- Data lama (kolom category) dipindah semua ke coa_gmi (data existing
-- semuanya dianggap milik GMI); coa_gis sengaja dikosongkan krn data COA
-- GIS belum ada - akan diisi manual belakangan lewat form edit barang.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

alter table public.barang
  add column if not exists coa_gmi text,
  add column if not exists coa_gis text;

update public.barang
  set coa_gmi = category
  where coa_gmi is null;

alter table public.barang
  drop column if exists category;
