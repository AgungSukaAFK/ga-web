-- FIX BUG URGENT: kode_mr/kode_po bisa punya nomor urut akhir yang DUPLIKAT
-- kalau 2 user submit hampir bersamaan dari departemen/lokasi BERBEDA.
-- Contoh nyata: LOURDES/PO/IX/26/HSE/725 dan LOURDES/PO/IX/26/DIZ/725.
--
-- Root cause: generateMRCode (mrService.ts) & generatePoCode
-- (purchaseOrderService.ts) menghitung nomor berikutnya dengan SELECT nomor
-- terakhir dari tabel lalu +1 di kode TypeScript - race condition
-- read-then-write klasik. UNIQUE constraint yang sudah ada di kode_mr/kode_po
-- TIDAK menangkap kasus ini karena segmen departemen/lokasinya beda, jadi
-- string lengkapnya juga beda walau angka di ujungnya sama.
--
-- Fix: nomor urut yang BENAR-BENAR dipakai saat INSERT sekarang direbut lewat
-- fungsi next_document_number() di bawah - atomic lewat
-- INSERT ... ON CONFLICT ... DO UPDATE (row lock Postgres menjamin 2
-- pemanggil bersamaan tidak akan pernah dapat angka yang sama, walau
-- request-nya dari departemen/lokasi berbeda). generateMRCode/generatePoCode
-- di TypeScript TETAP dipakai apa adanya untuk preview nomor di form (boleh
-- sedikit meleset/stale - cuma informasi buat user, bukan sumber kebenaran
-- lagi) - lihat createMaterialRequest/createPurchaseOrder yang sekarang
-- merebut nomor final lewat fungsi ini tepat sebelum INSERT.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

create table if not exists public.document_number_counters (
  doc_type text not null,
  company_code text not null,
  year int not null,
  last_number int not null default 0,
  primary key (doc_type, company_code, year)
);

alter table public.document_number_counters enable row level security;
-- Sengaja TIDAK ada policy sama sekali - tabel ini cuma boleh disentuh lewat
-- fungsi next_document_number() (SECURITY DEFINER, bypass RLS), tidak pernah
-- langsung dari client.

create or replace function public.next_document_number(
  p_doc_type text,
  p_company_code text,
  p_year int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into public.document_number_counters (doc_type, company_code, year, last_number)
  values (p_doc_type, p_company_code, p_year, 1)
  on conflict (doc_type, company_code, year)
  do update set last_number = document_number_counters.last_number + 1
  returning last_number into v_next;

  return v_next;
end;
$$;

grant execute on function public.next_document_number(text, text, int) to authenticated;

-- Backfill: seed counter dari nomor tertinggi yang SUDAH terpakai di data
-- existing, supaya nomor pertama yang di-generate fungsi ini tidak bentrok
-- dengan kode_mr/kode_po yang sudah ada. Pakai GREATEST supaya aman
-- dijalankan berulang (tidak pernah menurunkan counter yang sudah berjalan).
insert into public.document_number_counters (doc_type, company_code, year, last_number)
select
  'MR' as doc_type,
  company_code,
  extract(year from created_at)::int as year,
  max(regexp_replace(kode_mr, '^.*/([0-9]+)$', '\1')::int) as last_number
from public.material_requests
where kode_mr ~ '/[0-9]+$'
group by company_code, extract(year from created_at)::int
on conflict (doc_type, company_code, year)
do update set last_number = greatest(
  document_number_counters.last_number,
  excluded.last_number
);

insert into public.document_number_counters (doc_type, company_code, year, last_number)
select
  'PO' as doc_type,
  company_code,
  extract(year from created_at)::int as year,
  max(regexp_replace(kode_po, '^.*/([0-9]+)$', '\1')::int) as last_number
from public.purchase_orders
where kode_po ~ '/[0-9]+$'
group by company_code, extract(year from created_at)::int
on conflict (doc_type, company_code, year)
do update set last_number = greatest(
  document_number_counters.last_number,
  excluded.last_number
);
