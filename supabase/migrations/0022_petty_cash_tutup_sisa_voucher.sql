-- 0022_petty_cash_tutup_sisa_voucher.sql
--
-- Petty Cash: "Tutup Sisa Voucher". Voucher baru "Selesai" kalau seluruh
-- nominalnya ditarik, jadi Voucher yang sisanya tidak terpakai nyangkut
-- "Approved" selamanya: begitu ada tarikan yang dibayar, Pengajuan juga tidak
-- bisa dibatalkan lagi.
--
-- Pemilik Voucher (atau admin) menutup sisanya dengan alasan, tanpa approval:
-- sisa yang belum ditarik belum pernah memotong budget, jadi tidak ada uang
-- yang berpindah. Syaratnya kebalikan dari pembatalan: minimal 1 tarikan sudah
-- dibayar (kalau belum, jalurnya Ajukan Pembatalan). Bersifat final.
--
-- Setelah ditutup, Voucher "Selesai" begitu tarikan yang ada sudah
-- dideklarasikan & disetujui. Kalau sudah semua, langsung "Selesai" saat itu
-- juga.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SEBELUM kode
-- yang memakainya dideploy. Script IDEMPOTENT.

-- { amount, reason, closed_by, closed_by_name, closed_at } - bentuknya sama
-- dgn purchase_orders.closed_remainder (0019).
alter table public.petty_cash_voucher
  add column if not exists closed_remainder jsonb;

-- Satu sumber syarat "Voucher tuntas", dipakai trigger Deklarasi, recheck
-- admin, & RPC tutup sisa.
create or replace function public._pc_voucher_is_complete(
  p_voucher_id bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total_amount numeric;
  v_closed boolean;
  v_total_drawn numeric;
begin
  select total_amount, closed_remainder is not null
  into v_total_amount, v_closed
  from public.petty_cash_voucher
  where id = p_voucher_id;

  select coalesce(sum(amount), 0) into v_total_drawn
  from public.petty_cash_sub_voucher
  where voucher_id = p_voucher_id;

  if v_total_drawn < v_total_amount and not coalesce(v_closed, false) then
    return false;
  end if;

  return not exists (
    select 1
    from public.petty_cash_sub_voucher sv
    where sv.voucher_id = p_voucher_id
      and not exists (
        select 1 from public.petty_cash_deklarasi d
        where d.sub_voucher_id = sv.id and d.status = 'Approved'
      )
  );
end;
$$;

revoke execute on function public._pc_voucher_is_complete(bigint) from public;

-- REPLACES versi di 0004_petty_cash.sql - syaratnya pindah ke
-- _pc_voucher_is_complete.
create or replace function public.handle_petty_cash_deklarasi_complete_voucher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'Approved' or old.status is not distinct from 'Approved' then
    return new;
  end if;

  if public._pc_voucher_is_complete(new.voucher_id) then
    update public.petty_cash_voucher
    set status = 'Selesai', updated_at = now()
    where id = new.voucher_id
      and status = 'Approved';
  end if;

  return new;
end;
$$;

-- REPLACES versi di 0004_petty_cash.sql - idem.
create or replace function public._pc_admin_recheck_voucher_completion(
  p_voucher_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.petty_cash_voucher where id = p_voucher_id;

  if v_status is null then
    return; -- Voucher-nya sendiri sudah ikut terhapus (cascade dari atasnya).
  end if;

  if v_status <> 'Selesai' then
    return; -- Cuma relevan kalau sedang "Selesai" - status lain tidak disentuh.
  end if;

  if not public._pc_voucher_is_complete(p_voucher_id) then
    update public.petty_cash_voucher
    set status = 'Approved', updated_at = now()
    where id = p_voucher_id and status = 'Selesai';
  end if;
end;
$$;

revoke execute on function public._pc_admin_recheck_voucher_completion(bigint) from public;

-- Tarik Dana ditolak setelah sisanya ditutup. Lewat trigger supaya RPC
-- create_petty_cash_sub_voucher (0015) tidak perlu ditulis ulang.
create or replace function public.check_petty_cash_sub_voucher_remainder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.petty_cash_voucher
    where id = new.voucher_id
      and closed_remainder is not null
  ) then
    raise exception 'Sisa Voucher ini sudah ditutup - tidak bisa ditarik lagi.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_sub_voucher_check_remainder on public.petty_cash_sub_voucher;
create trigger on_petty_cash_sub_voucher_check_remainder
  before insert on public.petty_cash_sub_voucher
  for each row execute function public.check_petty_cash_sub_voucher_remainder();

create or replace function public.close_petty_cash_voucher_remainder(
  p_id bigint,
  p_reason text
)
returns public.petty_cash_voucher
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_voucher public.petty_cash_voucher%rowtype;
  v_row public.petty_cash_voucher%rowtype;
  v_sisa numeric;
  v_name text;
begin
  if v_reason is null then
    raise exception 'Alasan menutup sisa Voucher wajib diisi.';
  end if;

  -- Lock yang sama dgn create_petty_cash_sub_voucher, supaya sisa yang
  -- dihitung di bawah tidak balapan dgn Tarik Dana.
  select * into v_voucher from public.petty_cash_voucher where id = p_id for update;
  if not found then
    raise exception 'Voucher tidak ditemukan.';
  end if;
  if v_voucher.user_id <> auth.uid() and not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Hanya pemilik Voucher atau admin yang bisa menutup sisanya.';
  end if;
  if v_voucher.status <> 'Approved' then
    raise exception 'Sisa cuma bisa ditutup selama Voucher berstatus Approved.';
  end if;
  if v_voucher.closed_remainder is not null then
    raise exception 'Sisa Voucher ini sudah pernah ditutup.';
  end if;
  if exists (
    select 1 from public.petty_cash_pembatalan
    where pengajuan_id = v_voucher.pengajuan_id
      and status = 'Menunggu Persetujuan'
  ) then
    raise exception 'Pengajuan ini sedang diajukan pembatalan - tunggu Finance memprosesnya.';
  end if;
  if not exists (
    select 1 from public.petty_cash_sub_voucher
    where voucher_id = p_id and status = 'Selesai'
  ) then
    raise exception 'Belum ada tarikan yang dibayar - gunakan Ajukan Pembatalan.';
  end if;

  select v_voucher.total_amount - coalesce(sum(amount), 0) into v_sisa
  from public.petty_cash_sub_voucher
  where voucher_id = p_id and status <> 'Dibatalkan';

  if v_sisa <= 0 then
    raise exception 'Voucher ini sudah tidak punya sisa yang belum ditarik.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_voucher
  set closed_remainder = jsonb_build_object(
        'amount', v_sisa,
        'reason', v_reason,
        'closed_by', auth.uid(),
        'closed_by_name', v_name,
        'closed_at', now()
      ),
      discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'user_id', auth.uid(),
          'user_name', v_name,
          'message', '[TUTUP SISA] Sisa Rp '
            || replace(to_char(v_sisa, 'FM999,999,999,990'), ',', '.')
            || ' ditutup. Alasan: ' || v_reason,
          'timestamp', now()
        )
      ),
      updated_at = now()
  where id = p_id;

  if public._pc_voucher_is_complete(p_id) then
    update public.petty_cash_voucher
    set status = 'Selesai', updated_at = now()
    where id = p_id;
  end if;

  select * into v_row from public.petty_cash_voucher where id = p_id;
  return v_row;
end;
$$;

grant execute on function public.close_petty_cash_voucher_remainder(bigint, text) to authenticated;
