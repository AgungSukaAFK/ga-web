-- Begitu SEMUA sub-voucher (tarikan dana parsial, lihat
-- petty-cash-sub-voucher-setup.sql) sebuah Voucher sudah tuntas
-- didekralasikan & disetujui, DAN totalnya sudah menutup total_amount
-- Voucher, naikkan status Voucher dari "Approved" jadi "Selesai" - tanpa
-- ini Voucher tetap "Approved" selamanya walau siklusnya sudah tuntas di
-- sisi Deklarasi.
--
-- REPLACES versi awal (satu Deklarasi = satu Voucher penuh, langsung
-- selesai begitu deklarasi itu approved) - sekarang satu Voucher bisa
-- punya BANYAK sub-voucher/Deklarasi (tarikan bertahap), jadi kondisi
-- "selesai"-nya harus menunggu SEMUA tarikan tuntas, bukan cuma satu
-- Deklarasi pertama yang approved. "Selesai" TIDAK PERNAH diset dari app
-- code - murni hasil trigger ini.
--
-- SECURITY DEFINER: approver TERAKHIR Deklarasi bukan approver/pemilik
-- Voucher-nya sendiri (approvals Voucher sudah semua "approved" duluan) -
-- policy UPDATE petty_cash_voucher yang ada TIDAK mengizinkan dia update
-- baris Voucher secara langsung. Fungsi ini dieksekusi sebagai pemilik
-- tabel (bukan lewat RLS caller), jadi update di dalamnya bypass RLS
-- petty_cash_voucher.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-voucher-setup.sql, petty-cash-sub-voucher-setup.sql, &
-- petty-cash-deklarasi-sub-voucher-setup.sql. Kalau sebelumnya sudah pernah
-- menjalankan versi lama file ini, cukup jalankan ulang - `create or
-- replace function` otomatis meng-upgrade trigger yang sudah ada.

create or replace function public.handle_petty_cash_deklarasi_complete_voucher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher_id bigint;
  v_total_amount numeric;
  v_total_drawn numeric;
  v_all_reconciled boolean;
begin
  if new.status <> 'Approved' or old.status is not distinct from 'Approved' then
    return new;
  end if;

  v_voucher_id := new.voucher_id;

  select total_amount into v_total_amount
  from public.petty_cash_voucher
  where id = v_voucher_id;

  select coalesce(sum(amount), 0) into v_total_drawn
  from public.petty_cash_sub_voucher
  where voucher_id = v_voucher_id;

  -- Belum ada sub-voucher yang tarikannya BELUM punya Deklarasi berstatus
  -- Approved.
  select not exists (
    select 1
    from public.petty_cash_sub_voucher sv
    where sv.voucher_id = v_voucher_id
      and not exists (
        select 1 from public.petty_cash_deklarasi d
        where d.sub_voucher_id = sv.id and d.status = 'Approved'
      )
  ) into v_all_reconciled;

  if v_total_drawn >= v_total_amount and v_all_reconciled then
    update public.petty_cash_voucher
    set status = 'Selesai', updated_at = now()
    where id = v_voucher_id
      and status = 'Approved';
  end if;

  return new;
end;
$$;

drop trigger if exists on_petty_cash_deklarasi_complete_voucher on public.petty_cash_deklarasi;
create trigger on_petty_cash_deklarasi_complete_voucher
  after update on public.petty_cash_deklarasi
  for each row execute function public.handle_petty_cash_deklarasi_complete_voucher();
