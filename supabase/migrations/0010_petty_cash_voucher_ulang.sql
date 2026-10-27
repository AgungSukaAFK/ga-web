-- 0010_petty_cash_voucher_ulang.sql
--
-- Voucher Petty Cash boleh diajukan ULANG setelah ditolak. Dulu
-- unique (pengajuan_id) mutlak, jadi begitu Voucher pertama ditolak,
-- Pengajuan-nya buntu (cuma bisa lewat admin). Sekarang yang unik cuma
-- Voucher yang MASIH AKTIF (status selain 'Rejected') - satu Pengajuan tetap
-- paling banyak punya 1 Voucher aktif, yang ditolak tinggal jadi riwayat.
-- Pola yang sama dgn Deklarasi per tarikan di 0009_petty_cash_pengembalian.sql.
--
-- Efek samping yang disengaja: tanpa unique constraint, embed
-- `petty_cash_voucher(...)` dari petty_cash_pengajuan di PostgREST selalu
-- berupa array (bukan objek one-to-one) - sesuai cara app membacanya
-- (pickCurrentDoc, lib/pcChain.ts).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0004_petty_cash.sql. Script IDEMPOTENT.

-- ============================================================
-- 1. Unique Voucher aktif per Pengajuan
-- ============================================================

alter table public.petty_cash_voucher
  drop constraint if exists petty_cash_voucher_pengajuan_id_key;

-- Nama index ini dicek createVoucherFromPengajuan
-- (services/pettyCashVoucherService.ts) utk pesan error yang jelas.
create unique index if not exists petty_cash_voucher_pengajuan_active_key
  on public.petty_cash_voucher (pengajuan_id)
  where status <> 'Rejected';

create index if not exists idx_petty_cash_voucher_pengajuan_id
  on public.petty_cash_voucher (pengajuan_id);

-- ============================================================
-- 2. Hapus berantai Pengajuan oleh admin - semua Voucher-nya
-- ============================================================

-- REPLACES versi di 0004_petty_cash.sql (asal:
-- petty_cash_admin_full_management_setup.sql). Satu-satunya perubahan:
-- cabang 'pengajuan' menghapus SEMUA Voucher milik Pengajuan itu (yang
-- ditolak + pengajuan ulangnya), bukan cuma 1 - kalau tidak, FK
-- petty_cash_voucher.pengajuan_id (on delete restrict) menggagalkan hapus
-- Pengajuan-nya.
create or replace function public.admin_delete_petty_cash_document(
  p_doc_type text,
  p_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_summary jsonb;
  v_kode text;
  v_pengajuan public.petty_cash_pengajuan%rowtype;
  v_voucher record;
  v_vouchers jsonb := '[]'::jsonb;
  v_total_refunded numeric := 0;
  v_voucher_result jsonb;
  v_deklarasi public.petty_cash_deklarasi%rowtype;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception 'Hanya admin yang boleh menghapus dokumen Petty Cash.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Alasan penghapusan wajib diisi.';
  end if;

  if p_doc_type = 'deklarasi' then
    select * into v_deklarasi from public.petty_cash_deklarasi where id = p_id for update;
    if not found then
      raise exception 'Deklarasi tidak ditemukan.';
    end if;

    delete from public.petty_cash_deklarasi where id = p_id;
    perform public._pc_admin_recheck_voucher_completion(v_deklarasi.voucher_id);

    v_kode := v_deklarasi.kode_deklarasi;
    v_summary := jsonb_build_object(
      'deklarasi_id', v_deklarasi.id,
      'deklarasi_kode', v_deklarasi.kode_deklarasi
    );

  elsif p_doc_type = 'sub_voucher' then
    v_summary := public._pc_admin_refund_sub_voucher(p_id, p_reason);
    v_kode := v_summary->>'sub_voucher_kode';

  elsif p_doc_type = 'voucher' then
    v_summary := public._pc_admin_delete_voucher_cascade(p_id, p_reason);
    v_kode := v_summary->>'voucher_kode';

  elsif p_doc_type = 'pengajuan' then
    select * into v_pengajuan from public.petty_cash_pengajuan where id = p_id for update;
    if not found then
      raise exception 'Pengajuan tidak ditemukan.';
    end if;

    for v_voucher in
      select id from public.petty_cash_voucher where pengajuan_id = p_id
    loop
      v_voucher_result := public._pc_admin_delete_voucher_cascade(v_voucher.id, p_reason);
      v_vouchers := v_vouchers || jsonb_build_array(v_voucher_result);
      v_total_refunded := v_total_refunded
        + coalesce((v_voucher_result->>'total_refunded')::numeric, 0);
    end loop;

    delete from public.petty_cash_pengajuan where id = p_id;

    v_kode := v_pengajuan.kode_pengajuan;
    v_summary := jsonb_build_object(
      'pengajuan_id', v_pengajuan.id,
      'pengajuan_kode', v_pengajuan.kode_pengajuan,
      'vouchers_deleted', v_vouchers,
      'total_refunded', v_total_refunded
    );

  else
    raise exception 'Tipe dokumen tidak dikenal: %', p_doc_type;
  end if;

  insert into public.petty_cash_admin_audit_log (
    admin_id, action, doc_type, doc_id, kode, reason, detail
  ) values (
    auth.uid(), 'delete', p_doc_type, p_id, v_kode, p_reason, v_summary
  );

  return v_summary;
end;
$$;

grant execute on function public.admin_delete_petty_cash_document(text, bigint, text) to authenticated;
