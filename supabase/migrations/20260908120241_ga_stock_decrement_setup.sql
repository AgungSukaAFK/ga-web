-- Fitur "Kirim pakai Stok GA" - GA bisa penuhi item MR yang sudah full
-- approved tapi belum ada PO (level "Open 2") langsung dari Stok GA
-- (ga_stocks), tanpa proses pengadaan/PO/approval/BAST.
--
-- updateGaStock (services/gaStockService.ts) menerima quantity FINAL (bukan
-- delta) dan RLS ga_stocks_update-nya "using (true) with check (true)" -
-- kalau pengurangan stok dihitung read-then-subtract-then-write di JS
-- seperti generateMRCode/generatePoCode dulu, 2 user pakai stok yang sama
-- bersamaan bisa membuat stok jadi salah (bahkan minus). Fungsi ini
-- mengatomic-kan pengurangannya lewat row lock Postgres saat UPDATE, sama
-- persis polanya dengan next_document_number() di
-- document-number-counters-setup.sql yang sudah dipakai utk fix bug nomor
-- PO/MR duplikat.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

create or replace function public.decrement_ga_stock(
  p_id bigint,
  p_qty numeric
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new numeric;
begin
  update public.ga_stocks
  set quantity = quantity - p_qty,
      updated_at = now()
  where id = p_id
    and quantity >= p_qty
  returning quantity into v_new;

  if v_new is null then
    raise exception 'Stok tidak cukup atau baris stok tidak ditemukan';
  end if;

  return v_new;
end;
$$;

grant execute on function public.decrement_ga_stock(bigint, numeric) to authenticated;
