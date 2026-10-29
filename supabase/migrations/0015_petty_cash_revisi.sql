-- 0015_petty_cash_revisi.sql
--
-- Revisi Petty Cash (masukan user, Okt 2026). Empat perubahan:
--
--  1. ESKALASI. User departemen GA (General Affair/HRGA-HSE) & role admin
--     boleh membuat Pengajuan walau masih punya tarikan yang belum
--     dideklarasikan (user lain tetap diblokir, lihat
--     checkPengajuanEligibility, services/pettyCashPengajuanService.ts).
--     Pengajuan seperti itu otomatis ditandai `is_eskalasi`; GA/admin juga
--     boleh mencentangnya manual. Flag ini cuma penanda di layar & Excel,
--     TIDAK dicetak. Trigger di bawah memastikan cuma GA/admin yang bisa
--     menyalakannya.
--
--  2. METODE PENCAIRAN (Transfer / Cash / Overbook). Dipilih requester saat
--     Buat Voucher (Transfer = sekalian pilih rekening dari Profile, di-
--     snapshot ke Voucher). Approver Voucher bisa menggantinya lewat "Edit &
--     Setujui"; GA/Finance/admin/approver juga bisa lewat RPC
--     update_petty_cash_voucher_payment_method. Saat Finance membayar
--     tarikan, metode final (+ rekening) dicatat di Sub-Voucher: Transfer &
--     Overbook WAJIB bukti, Cash opsional.
--
--  3. PEMBATALAN PENGAJUAN (tabel `petty_cash_pembatalan`). Requester
--     mengajukan pembatalan, Finance approver (department Finance + role
--     approver, atau admin) menyetujui/menolak. Boleh selama BELUM ADA
--     tarikan yang dibayar Finance. Disetujui = Pengajuan, Voucher aktif, &
--     tarikan yang belum dibayar jadi "Dibatalkan", potongan budget
--     tarikan itu di-refund. Selama permintaan masih menunggu, Tarik Dana,
--     pembayaran tarikan, & pembuatan Voucher baru ditahan.
--
--  4. TEMPLATE "APPROVAL DEKLARASI" WAJIB PUNYA >= 1 APPROVER FINANCE
--     (department 'Finance' di approval_path). Dijaga di simpan template &
--     saat Deklarasi dibuat (template lama yang belum memenuhi langsung
--     ketahuan, bukan diam-diam lolos). Cek template yang perlu diperbaiki:
--       select id, template_name from public.pc_approval_templates t
--       where approval_type = 'Approval Deklarasi'
--         and not exists (
--           select 1 from jsonb_array_elements(t.approval_path) a
--           where a->>'department' = 'Finance'
--         );
--
-- Daftar departemen GA di bawah HARUS sama dgn GA_DEPARTMENTS
-- (lib/constants/departments.ts), sama seperti RLS petty cash lainnya.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0014_petty_cash_pengguna_budget.sql. Script IDEMPOTENT.

-- ============================================================
-- 1. Eskalasi
-- ============================================================

alter table public.petty_cash_pengajuan
  add column if not exists is_eskalasi boolean not null default false;

create or replace function public.check_petty_cash_pengajuan_eskalasi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_eskalasi
    and (tg_op = 'INSERT' or old.is_eskalasi is distinct from new.is_eskalasi)
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'admin' or p.department in ('General Affair', 'HRGA-HSE'))
    )
  then
    raise exception 'Hanya user departemen GA atau role Admin yang boleh menandai Pengajuan sebagai Eskalasi.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_pengajuan_check_eskalasi on public.petty_cash_pengajuan;
create trigger on_petty_cash_pengajuan_check_eskalasi
  before insert or update of is_eskalasi on public.petty_cash_pengajuan
  for each row execute function public.check_petty_cash_pengajuan_eskalasi();

-- ============================================================
-- 2. Metode pencairan
-- ============================================================

-- Voucher: rencana metode dari requester (bisa diubah approver/GA/Finance).
-- Null = Voucher lama dari sebelum fitur ini, Finance memilih saat bayar.
alter table public.petty_cash_voucher
  add column if not exists payment_method text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder_name text;

-- Sub-Voucher: metode yang BENAR-BENAR dipakai Finance saat membayar -
-- kosong selama "Menunggu Pembayaran" (yang berlaku = rencana di Voucher).
alter table public.petty_cash_sub_voucher
  add column if not exists payment_method text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_holder_name text;

alter table public.petty_cash_voucher
  drop constraint if exists petty_cash_voucher_payment_method_check;
alter table public.petty_cash_voucher
  add constraint petty_cash_voucher_payment_method_check check (
    payment_method is null or payment_method in ('Transfer', 'Cash', 'Overbook')
  );

alter table public.petty_cash_voucher
  drop constraint if exists petty_cash_voucher_payment_bank_check;
alter table public.petty_cash_voucher
  add constraint petty_cash_voucher_payment_bank_check check (
    payment_method is distinct from 'Transfer'
    or (
      coalesce(trim(bank_name), '') <> ''
      and coalesce(trim(bank_account_number), '') <> ''
      and coalesce(trim(bank_account_holder_name), '') <> ''
    )
  );

alter table public.petty_cash_sub_voucher
  drop constraint if exists petty_cash_sub_voucher_payment_method_check;
alter table public.petty_cash_sub_voucher
  add constraint petty_cash_sub_voucher_payment_method_check check (
    payment_method is null or payment_method in ('Transfer', 'Cash', 'Overbook')
  );

alter table public.petty_cash_sub_voucher
  drop constraint if exists petty_cash_sub_voucher_payment_bank_check;
alter table public.petty_cash_sub_voucher
  add constraint petty_cash_sub_voucher_payment_bank_check check (
    payment_method is distinct from 'Transfer'
    or (
      coalesce(trim(bank_name), '') <> ''
      and coalesce(trim(bank_account_number), '') <> ''
      and coalesce(trim(bank_account_holder_name), '') <> ''
    )
  );

-- Siapa yang boleh melihat/mengubah metode pencairan sebuah Voucher selain
-- pemiliknya: admin, departemen GA, departemen Finance, atau siapa pun yang
-- tercantum di jalur approval Voucher itu.
create or replace function public._pc_can_manage_voucher_payment(
  p_voucher public.petty_cash_voucher
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or p.department in ('General Affair', 'HRGA-HSE', 'Finance')
      )
  )
  or coalesce(p_voucher.approvals, '[]'::jsonb) @> jsonb_build_array(
    jsonb_build_object('userid', auth.uid()::text)
  );
$$;

revoke execute on function public._pc_can_manage_voucher_payment(public.petty_cash_voucher) from public;

-- Rekening tersimpan milik PEMILIK Voucher - user_bank_accounts privat
-- (RLS per user), jadi approver/GA/Finance yang mengganti metode ke Transfer
-- membacanya lewat sini.
create or replace function public.get_petty_cash_voucher_bank_accounts(
  p_voucher_id bigint
)
returns setof public.user_bank_accounts
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_voucher public.petty_cash_voucher%rowtype;
begin
  select * into v_voucher from public.petty_cash_voucher where id = p_voucher_id;
  if not found then
    raise exception 'Voucher tidak ditemukan.';
  end if;
  if v_voucher.user_id <> auth.uid()
    and not public._pc_can_manage_voucher_payment(v_voucher)
  then
    raise exception 'Anda tidak berwenang melihat rekening pemohon Voucher ini.';
  end if;

  return query
    select * from public.user_bank_accounts
    where user_id = v_voucher.user_id
    order by created_at;
end;
$$;

grant execute on function public.get_petty_cash_voucher_bank_accounts(bigint) to authenticated;

-- Ganti metode pencairan Voucher di luar "Edit & Setujui" (GA/Finance/
-- admin/approver Voucher). Perubahannya dicatat sbg entri diskusi supaya
-- jejaknya kelihatan di dokumen.
create or replace function public.update_petty_cash_voucher_payment_method(
  p_id bigint,
  p_payment_method text,
  p_bank_name text default null,
  p_bank_account_number text default null,
  p_bank_account_holder_name text default null
)
returns public.petty_cash_voucher
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.petty_cash_voucher%rowtype;
  v_row public.petty_cash_voucher%rowtype;
  v_name text;
  v_old_label text;
  v_new_label text;
begin
  select * into v_voucher from public.petty_cash_voucher where id = p_id for update;
  if not found then
    raise exception 'Voucher tidak ditemukan.';
  end if;
  if not public._pc_can_manage_voucher_payment(v_voucher) then
    raise exception 'Anda tidak berwenang mengubah metode pencairan Voucher ini.';
  end if;
  if v_voucher.status not in ('In Approval', 'Approved') then
    raise exception 'Metode pencairan cuma bisa diubah selama Voucher masih In Approval/Approved.';
  end if;
  if p_payment_method is null or p_payment_method not in ('Transfer', 'Cash', 'Overbook') then
    raise exception 'Metode pencairan tidak valid.';
  end if;
  if p_payment_method = 'Transfer' and (
    coalesce(trim(p_bank_name), '') = ''
    or coalesce(trim(p_bank_account_number), '') = ''
    or coalesce(trim(p_bank_account_holder_name), '') = ''
  ) then
    raise exception 'Rekening tujuan transfer wajib diisi (bank, nomor, atas nama).';
  end if;

  v_old_label := coalesce(v_voucher.payment_method, 'Belum dipilih')
    || case when v_voucher.payment_method = 'Transfer'
         then ' (' || v_voucher.bank_name || ' ' || v_voucher.bank_account_number || ')'
         else '' end;
  v_new_label := p_payment_method
    || case when p_payment_method = 'Transfer'
         then ' (' || coalesce(trim(p_bank_name), '') || ' ' || coalesce(trim(p_bank_account_number), '') || ')'
         else '' end;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_voucher
  set payment_method = p_payment_method,
      bank_name = case when p_payment_method = 'Transfer' then nullif(trim(p_bank_name), '') end,
      bank_account_number = case when p_payment_method = 'Transfer' then nullif(trim(p_bank_account_number), '') end,
      bank_account_holder_name = case when p_payment_method = 'Transfer' then nullif(trim(p_bank_account_holder_name), '') end,
      discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'user_id', auth.uid(),
          'user_name', v_name,
          'message', '[METODE PENCAIRAN] Diubah dari ' || v_old_label || ' menjadi ' || v_new_label || '.',
          'timestamp', now()
        )
      ),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.update_petty_cash_voucher_payment_method(bigint, text, text, text, text) to authenticated;

-- Pembayaran tarikan oleh Finance - REPLACES versi di 0004_petty_cash.sql
-- (asal: petty_cash_sub_voucher_payment_setup.sql). Tambahan: metode
-- pencairan + rekening dicatat, bukti cuma wajib utk Transfer & Overbook,
-- dan ditolak selama Pengajuan-nya sedang diajukan pembatalan.
-- p_payment_method boleh null (pemanggil lama 2 argumen) = pakai rencana di
-- Voucher, fallback 'Transfer' (perilaku lama: bukti wajib).
drop function if exists public.mark_petty_cash_sub_voucher_paid(bigint, jsonb);

create or replace function public.mark_petty_cash_sub_voucher_paid(
  p_id bigint,
  p_payment_proof jsonb,
  p_payment_method text default null,
  p_bank_name text default null,
  p_bank_account_number text default null,
  p_bank_account_holder_name text default null
)
returns public.petty_cash_sub_voucher
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department text;
  v_role text;
  v_sv public.petty_cash_sub_voucher%rowtype;
  v_voucher public.petty_cash_voucher%rowtype;
  v_method text;
  v_bank_name text;
  v_bank_number text;
  v_bank_holder text;
  v_row public.petty_cash_sub_voucher%rowtype;
begin
  select department, role into v_department, v_role
  from public.profiles where id = auth.uid();

  if not (
    v_role = 'admin'
    or (v_department = 'Finance' and v_role = 'approver')
  ) then
    raise exception 'Anda tidak berwenang menyelesaikan pembayaran Petty Cash.';
  end if;

  select * into v_sv from public.petty_cash_sub_voucher where id = p_id for update;
  if not found or v_sv.status <> 'Menunggu Pembayaran' then
    raise exception 'Sub-Voucher tidak ditemukan atau sudah tidak menunggu pembayaran.';
  end if;

  select * into v_voucher from public.petty_cash_voucher where id = v_sv.voucher_id;

  if exists (
    select 1 from public.petty_cash_pembatalan pb
    where pb.pengajuan_id = v_voucher.pengajuan_id
      and pb.status = 'Menunggu Persetujuan'
  ) then
    raise exception 'Pengajuan tarikan ini sedang diajukan pembatalan - proses dulu permintaan pembatalannya.';
  end if;

  v_method := coalesce(p_payment_method, v_voucher.payment_method, 'Transfer');
  if v_method not in ('Transfer', 'Cash', 'Overbook') then
    raise exception 'Metode pencairan tidak valid.';
  end if;

  if v_method in ('Transfer', 'Overbook')
    and (p_payment_proof is null or jsonb_typeof(p_payment_proof) <> 'array' or jsonb_array_length(p_payment_proof) = 0)
  then
    raise exception 'Bukti % wajib dilampirkan.', lower(v_method);
  end if;

  if v_method = 'Transfer' then
    if p_payment_method is null then
      v_bank_name := v_voucher.bank_name;
      v_bank_number := v_voucher.bank_account_number;
      v_bank_holder := v_voucher.bank_account_holder_name;
    else
      v_bank_name := nullif(trim(p_bank_name), '');
      v_bank_number := nullif(trim(p_bank_account_number), '');
      v_bank_holder := nullif(trim(p_bank_account_holder_name), '');
    end if;
  end if;

  -- Pemanggil lama (tanpa metode) atas Voucher lama tanpa rekening: tetap
  -- diterima, metodenya dicatat tanpa rekening daripada gagal constraint.
  if v_method = 'Transfer' and p_payment_method is not null
    and (v_bank_name is null or v_bank_number is null or v_bank_holder is null)
  then
    raise exception 'Rekening tujuan transfer wajib diisi (bank, nomor, atas nama).';
  end if;
  if v_method = 'Transfer' and (v_bank_name is null or v_bank_number is null or v_bank_holder is null) then
    v_method := null;
  end if;

  update public.petty_cash_sub_voucher
  set status = 'Selesai',
      payment_proof = case
        when p_payment_proof is not null and jsonb_typeof(p_payment_proof) = 'array'
          then p_payment_proof
        else '[]'::jsonb end,
      payment_method = v_method,
      bank_name = v_bank_name,
      bank_account_number = v_bank_number,
      bank_account_holder_name = v_bank_holder,
      paid_at = now(),
      paid_by = auth.uid(),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.mark_petty_cash_sub_voucher_paid(bigint, jsonb, text, text, text, text) to authenticated;

-- ============================================================
-- 3. Pembatalan Pengajuan
-- ============================================================

create table if not exists public.petty_cash_pembatalan (
  id bigint generated by default as identity primary key,
  pengajuan_id bigint not null references public.petty_cash_pengajuan(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Denormalisasi dari Pengajuan - antrian Finance difilter per company.
  company_code text not null,
  reason text not null,
  -- 'Menunggu Persetujuan' -> 'Disetujui' (rantai dibatalkan) atau
  -- 'Ditolak' (rantai jalan terus, requester boleh mengajukan lagi).
  status text not null default 'Menunggu Persetujuan',
  -- Alasan penolakan / catatan persetujuan dari Finance.
  finance_note text,
  -- Ringkasan yang ikut dibatalkan saat disetujui (voucher, tarikan, refund).
  detail jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint petty_cash_pembatalan_status_check
    check (status in ('Menunggu Persetujuan', 'Disetujui', 'Ditolak'))
);

-- Paling banyak 1 permintaan yang masih menunggu per Pengajuan.
create unique index if not exists petty_cash_pembatalan_pending_key
  on public.petty_cash_pembatalan (pengajuan_id)
  where status = 'Menunggu Persetujuan';

create index if not exists idx_petty_cash_pembatalan_pengajuan_id
  on public.petty_cash_pembatalan (pengajuan_id);
create index if not exists idx_petty_cash_pembatalan_status
  on public.petty_cash_pembatalan (status);
create index if not exists idx_petty_cash_pembatalan_user_id
  on public.petty_cash_pembatalan (user_id);

create or replace function public.handle_petty_cash_pembatalan_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_pembatalan_write on public.petty_cash_pembatalan;
create trigger on_petty_cash_pembatalan_write
  before insert or update on public.petty_cash_pembatalan
  for each row execute function public.handle_petty_cash_pembatalan_audit();

alter table public.petty_cash_pembatalan enable row level security;

-- Baca: semua user login, sama seperti tabel petty cash lain.
drop policy if exists "petty_cash_pembatalan_select" on public.petty_cash_pembatalan;
create policy "petty_cash_pembatalan_select"
  on public.petty_cash_pembatalan
  for select
  to authenticated
  using (true);

-- SENGAJA TIDAK ADA policy INSERT/UPDATE/DELETE - semua lewat RPC di bawah.

-- Jumlah tarikan Pengajuan ini yang SUDAH dibayar Finance - batas boleh
-- dibatalkan atau tidak.
create or replace function public._pc_pengajuan_paid_tarikan_count(
  p_pengajuan_id bigint
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.petty_cash_sub_voucher sv
  join public.petty_cash_voucher v on v.id = sv.voucher_id
  where v.pengajuan_id = p_pengajuan_id
    and sv.status = 'Selesai';
$$;

revoke execute on function public._pc_pengajuan_paid_tarikan_count(bigint) from public;

create or replace function public.request_petty_cash_pembatalan(
  p_pengajuan_id bigint,
  p_reason text
)
returns public.petty_cash_pembatalan
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pj public.petty_cash_pengajuan%rowtype;
  v_row public.petty_cash_pembatalan%rowtype;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Alasan pembatalan wajib diisi.';
  end if;

  select * into v_pj from public.petty_cash_pengajuan where id = p_pengajuan_id for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan.';
  end if;
  if v_pj.user_id <> auth.uid() then
    raise exception 'Hanya pemohon Pengajuan ini yang bisa mengajukan pembatalan.';
  end if;
  if v_pj.status not in ('In Approval', 'Approved') then
    raise exception 'Pengajuan berstatus "%" tidak bisa dibatalkan.', v_pj.status;
  end if;
  if public._pc_pengajuan_paid_tarikan_count(p_pengajuan_id) > 0 then
    raise exception 'Sudah ada tarikan yang dibayar Finance - Pengajuan tidak bisa dibatalkan. Selesaikan lewat Deklarasi/Pengembalian Dana.';
  end if;
  if exists (
    select 1 from public.petty_cash_pembatalan
    where pengajuan_id = p_pengajuan_id and status = 'Menunggu Persetujuan'
  ) then
    raise exception 'Pembatalan Pengajuan ini sudah diajukan dan sedang menunggu persetujuan Finance.';
  end if;

  insert into public.petty_cash_pembatalan (pengajuan_id, user_id, company_code, reason)
  values (v_pj.id, auth.uid(), v_pj.company_code, trim(p_reason))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.request_petty_cash_pembatalan(bigint, text) to authenticated;

create or replace function public.approve_petty_cash_pembatalan(
  p_id bigint,
  p_note text default null
)
returns public.petty_cash_pembatalan
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department text;
  v_role text;
  v_req public.petty_cash_pembatalan%rowtype;
  v_pj public.petty_cash_pengajuan%rowtype;
  v_voucher record;
  v_sv record;
  v_new_budget numeric;
  v_refunded numeric := 0;
  v_vouchers jsonb := '[]'::jsonb;
  v_sub_vouchers jsonb := '[]'::jsonb;
begin
  select department, role into v_department, v_role
  from public.profiles where id = auth.uid();

  if not (
    v_role = 'admin'
    or (v_department = 'Finance' and v_role = 'approver')
  ) then
    raise exception 'Anda tidak berwenang memproses pembatalan Petty Cash.';
  end if;

  select * into v_req from public.petty_cash_pembatalan where id = p_id for update;
  if not found or v_req.status <> 'Menunggu Persetujuan' then
    raise exception 'Permintaan pembatalan tidak ditemukan atau sudah diproses.';
  end if;

  select * into v_pj from public.petty_cash_pengajuan where id = v_req.pengajuan_id for update;
  if v_pj.status not in ('In Approval', 'Approved') then
    raise exception 'Pengajuan sudah berstatus "%" - tidak bisa dibatalkan lagi. Tolak permintaan ini.', v_pj.status;
  end if;
  if public._pc_pengajuan_paid_tarikan_count(v_pj.id) > 0 then
    raise exception 'Sudah ada tarikan yang dibayar Finance - Pengajuan tidak bisa dibatalkan. Tolak permintaan ini.';
  end if;

  for v_voucher in
    select * from public.petty_cash_voucher
    where pengajuan_id = v_pj.id
      and status not in ('Rejected', 'Dibatalkan')
    for update
  loop
    for v_sv in
      select * from public.petty_cash_sub_voucher
      where voucher_id = v_voucher.id
        and status = 'Menunggu Pembayaran'
      for update
    loop
      update public.petty_cash_sub_voucher
      set status = 'Dibatalkan', updated_at = now()
      where id = v_sv.id;

      if v_voucher.budget_id is not null then
        update public.petty_cash_budget
        set current_budget = current_budget + v_sv.amount
        where id = v_voucher.budget_id
        returning current_budget into v_new_budget;

        -- ref_id = id Sub-Voucher, sama seperti 'deduction'/'refund' lain
        -- (riwayat budget me-resolve ref_id ke dokumen Sub-Voucher).
        insert into public.petty_cash_budget_history (
          budget_id, ref_type, ref_id, user_id, change_amount, previous_budget, new_budget, description
        ) values (
          v_voucher.budget_id, 'refund', v_sv.id, auth.uid(), v_sv.amount,
          v_new_budget - v_sv.amount, v_new_budget,
          'Refund pembatalan tarikan ' || v_sv.kode_sub_voucher
            || ' (Pengajuan ' || v_pj.kode_pengajuan || ' dibatalkan)'
        );
      end if;

      v_refunded := v_refunded + v_sv.amount;
      v_sub_vouchers := v_sub_vouchers || jsonb_build_array(jsonb_build_object(
        'id', v_sv.id, 'kode', v_sv.kode_sub_voucher, 'amount', v_sv.amount
      ));
    end loop;

    update public.petty_cash_voucher
    set status = 'Dibatalkan', updated_at = now()
    where id = v_voucher.id;

    v_vouchers := v_vouchers || jsonb_build_array(jsonb_build_object(
      'id', v_voucher.id, 'kode', v_voucher.kode_voucher, 'status_lama', v_voucher.status
    ));
  end loop;

  update public.petty_cash_pengajuan
  set status = 'Dibatalkan', updated_at = now()
  where id = v_pj.id;

  update public.petty_cash_pembatalan
  set status = 'Disetujui',
      finance_note = nullif(trim(coalesce(p_note, '')), ''),
      processed_at = now(),
      processed_by = auth.uid(),
      detail = jsonb_build_object(
        'pengajuan_status_lama', v_pj.status,
        'vouchers', v_vouchers,
        'sub_vouchers', v_sub_vouchers,
        'total_refunded', v_refunded
      )
  where id = p_id
  returning * into v_req;

  return v_req;
end;
$$;

grant execute on function public.approve_petty_cash_pembatalan(bigint, text) to authenticated;

create or replace function public.reject_petty_cash_pembatalan(
  p_id bigint,
  p_reason text
)
returns public.petty_cash_pembatalan
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department text;
  v_role text;
  v_row public.petty_cash_pembatalan%rowtype;
begin
  select department, role into v_department, v_role
  from public.profiles where id = auth.uid();

  if not (
    v_role = 'admin'
    or (v_department = 'Finance' and v_role = 'approver')
  ) then
    raise exception 'Anda tidak berwenang memproses pembatalan Petty Cash.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  update public.petty_cash_pembatalan
  set status = 'Ditolak',
      finance_note = trim(p_reason),
      processed_at = now(),
      processed_by = auth.uid()
  where id = p_id
    and status = 'Menunggu Persetujuan'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Permintaan pembatalan tidak ditemukan atau sudah diproses.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.reject_petty_cash_pembatalan(bigint, text) to authenticated;

-- Voucher baru tidak boleh dibuat selama Pengajuan-nya sedang diajukan
-- pembatalan (RLS insert sudah mewajibkan Pengajuan "Approved", jadi
-- Pengajuan yang sudah "Dibatalkan" otomatis tertolak).
create or replace function public.check_petty_cash_voucher_pembatalan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.petty_cash_pembatalan
    where pengajuan_id = new.pengajuan_id
      and status = 'Menunggu Persetujuan'
  ) then
    raise exception 'Pengajuan ini sedang diajukan pembatalan - Voucher belum bisa dibuat.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_voucher_check_pembatalan on public.petty_cash_voucher;
create trigger on_petty_cash_voucher_check_pembatalan
  before insert on public.petty_cash_voucher
  for each row execute function public.check_petty_cash_voucher_pembatalan();

-- Tarik Dana - REPLACES versi di 0004_petty_cash.sql (asal:
-- petty_cash_sub_voucher_payment_setup.sql). Satu-satunya tambahan: ditolak
-- selama Pengajuan-nya sedang diajukan pembatalan.
create or replace function public.create_petty_cash_sub_voucher(
  p_id bigint,
  p_kode_sub_voucher text,
  p_voucher_id bigint,
  p_draws jsonb, -- [{"item_index": 0, "qty": 3}, ...]
  p_notes text
)
returns public.petty_cash_sub_voucher
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voucher public.petty_cash_voucher%rowtype;
  v_items jsonb;
  v_item jsonb;
  v_draw jsonb;
  v_idx int;
  v_qty numeric;
  v_orig_qty numeric;
  v_unit_price numeric;
  v_already_drawn numeric;
  v_drawn_map jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_amount numeric := 0;
  v_already_total numeric;
  v_new_budget numeric;
  v_row public.petty_cash_sub_voucher%rowtype;
begin
  if p_draws is null or jsonb_typeof(p_draws) <> 'array' or jsonb_array_length(p_draws) = 0 then
    raise exception 'Pilih minimal 1 barang untuk ditarik.';
  end if;

  select * into v_voucher from public.petty_cash_voucher where id = p_voucher_id for update;
  if not found then
    raise exception 'Voucher tidak ditemukan.';
  end if;
  if v_voucher.user_id <> auth.uid() then
    raise exception 'Anda bukan pemilik Voucher ini.';
  end if;
  if v_voucher.status <> 'Approved' then
    raise exception 'Voucher belum/sudah tidak berstatus Approved, tidak bisa ditarik.';
  end if;
  if v_voucher.budget_id is null then
    raise exception 'Voucher ini belum punya Budget yang ditetapkan - hubungi GA/Admin.';
  end if;
  if exists (
    select 1 from public.petty_cash_pembatalan
    where pengajuan_id = v_voucher.pengajuan_id
      and status = 'Menunggu Persetujuan'
  ) then
    raise exception 'Pengajuan ini sedang diajukan pembatalan - Tarik Dana ditahan sampai Finance memprosesnya.';
  end if;

  v_items := v_voucher.items;

  select coalesce(jsonb_object_agg(item_index, total_qty), '{}'::jsonb)
  into v_drawn_map
  from (
    select (elem->>'item_index')::int as item_index, sum((elem->>'qty')::numeric) as total_qty
    from public.petty_cash_sub_voucher sv, jsonb_array_elements(sv.items) elem
    where sv.voucher_id = p_voucher_id
      and sv.status <> 'Dibatalkan'
    group by (elem->>'item_index')::int
  ) t;

  for v_draw in select * from jsonb_array_elements(p_draws)
  loop
    v_idx := (v_draw->>'item_index')::int;
    v_qty := (v_draw->>'qty')::numeric;

    if v_idx is null or v_idx < 0 or v_idx >= jsonb_array_length(v_items) then
      raise exception 'Index barang tidak valid.';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Qty tarikan harus lebih dari 0.';
    end if;

    v_item := v_items -> v_idx;
    v_orig_qty := (v_item->>'qty')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_already_drawn := coalesce((v_drawn_map->>(v_idx::text))::numeric, 0);

    if v_qty > (v_orig_qty - v_already_drawn) then
      raise exception 'Qty tarikan utk "%" melebihi sisa (sisa %).',
        v_item->>'part_name', (v_orig_qty - v_already_drawn);
    end if;

    v_new_items := v_new_items || jsonb_build_array(jsonb_build_object(
      'item_index', v_idx,
      'barang_id', v_item->'barang_id',
      'part_name', v_item->'part_name',
      'category', v_item->'category',
      'uom', v_item->'uom',
      'qty', v_qty,
      'unit_price', v_unit_price,
      'subtotal', v_qty * v_unit_price,
      'note', v_item->'note',
      'coa', v_item->'coa'
    ));
    v_amount := v_amount + (v_qty * v_unit_price);

    v_drawn_map := jsonb_set(v_drawn_map, array[v_idx::text], to_jsonb(v_already_drawn + v_qty));
  end loop;

  select coalesce(sum(amount), 0) into v_already_total
  from public.petty_cash_sub_voucher
  where voucher_id = p_voucher_id
    and status <> 'Dibatalkan';

  if v_amount > (v_voucher.total_amount - v_already_total) then
    raise exception 'Nominal tarikan melebihi sisa Voucher.';
  end if;

  update public.petty_cash_budget
  set current_budget = current_budget - v_amount
  where id = v_voucher.budget_id
    and current_budget >= v_amount
  returning current_budget into v_new_budget;

  if v_new_budget is null then
    raise exception 'Sisa budget departemen tidak mencukupi untuk tarikan ini.';
  end if;

  insert into public.petty_cash_sub_voucher (
    id, kode_sub_voucher, voucher_id, user_id, amount, items, notes, status
  )
  values (
    p_id, p_kode_sub_voucher, p_voucher_id, auth.uid(), v_amount, v_new_items, p_notes,
    'Menunggu Pembayaran'
  )
  returning * into v_row;

  insert into public.petty_cash_budget_history (
    budget_id, ref_type, ref_id, user_id, change_amount, previous_budget, new_budget, description
  ) values (
    v_voucher.budget_id, 'deduction', v_row.id, auth.uid(), -v_amount,
    v_new_budget + v_amount, v_new_budget,
    'Tarikan Sub-Voucher ' || p_kode_sub_voucher
  );

  return v_row;
end;
$$;

grant execute on function public.create_petty_cash_sub_voucher(bigint, text, bigint, jsonb, text) to authenticated;

-- Hapus Sub-Voucher oleh admin - REPLACES versi di
-- 0009_petty_cash_pengembalian.sql. Tarikan "Dibatalkan" sudah di-refund
-- saat pembatalan disetujui, jadi tidak di-refund dua kali.
create or replace function public._pc_admin_refund_sub_voucher(
  p_sub_voucher_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sv public.petty_cash_sub_voucher%rowtype;
  v_voucher public.petty_cash_voucher%rowtype;
  v_deklarasi_ids bigint[];
  v_deklarasi_kode text;
  v_returned numeric;
  v_refund numeric;
  v_new_budget numeric;
begin
  select * into v_sv from public.petty_cash_sub_voucher where id = p_sub_voucher_id for update;
  if not found then
    raise exception 'Sub-Voucher tidak ditemukan.';
  end if;

  select * into v_voucher from public.petty_cash_voucher where id = v_sv.voucher_id for update;

  select array_agg(id order by id), string_agg(kode_deklarasi, ', ' order by id)
  into v_deklarasi_ids, v_deklarasi_kode
  from public.petty_cash_deklarasi where sub_voucher_id = p_sub_voucher_id;

  delete from public.petty_cash_deklarasi where sub_voucher_id = p_sub_voucher_id;

  select coalesce(sum(amount), 0) into v_returned
  from public.petty_cash_pengembalian
  where sub_voucher_id = p_sub_voucher_id
    and status = 'Selesai';

  v_refund := case when v_sv.status = 'Dibatalkan' then 0 else v_sv.amount - v_returned end;

  if v_voucher.budget_id is not null and v_refund > 0 then
    update public.petty_cash_budget
    set current_budget = current_budget + v_refund
    where id = v_voucher.budget_id
    returning current_budget into v_new_budget;

    insert into public.petty_cash_budget_history (
      budget_id, ref_type, ref_id, user_id, change_amount, previous_budget, new_budget, description
    ) values (
      v_voucher.budget_id, 'refund', v_sv.id, auth.uid(), v_refund,
      v_new_budget - v_refund, v_new_budget,
      'Refund penghapusan Sub-Voucher ' || v_sv.kode_sub_voucher || ' oleh admin - alasan: ' || p_reason
    );
  end if;

  delete from public.petty_cash_sub_voucher where id = p_sub_voucher_id;

  perform public._pc_admin_recheck_voucher_completion(v_sv.voucher_id);

  return jsonb_build_object(
    'sub_voucher_id', v_sv.id,
    'sub_voucher_kode', v_sv.kode_sub_voucher,
    'refunded_amount', greatest(v_refund, 0),
    'deklarasi_id', v_deklarasi_ids[array_upper(v_deklarasi_ids, 1)],
    'deklarasi_ids', to_jsonb(coalesce(v_deklarasi_ids, '{}')),
    'deklarasi_kode', v_deklarasi_kode
  );
end;
$$;

revoke execute on function public._pc_admin_refund_sub_voucher(bigint, text) from public;

-- Edit paksa Sub-Voucher oleh admin - tolak tarikan yang sudah
-- "Dibatalkan" (budget-nya sudah di-refund; mengaktifkannya lagi lewat sini
-- akan membuat potongan budget tidak sinkron). Pembungkus tipis supaya isi
-- fungsi asli di 0004 tidak perlu disalin ulang.
create or replace function public.check_petty_cash_sub_voucher_dibatalkan()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'Dibatalkan' and new.status is distinct from 'Dibatalkan' then
    raise exception 'Sub-Voucher % sudah dibatalkan dan tidak bisa diaktifkan lagi.', old.kode_sub_voucher;
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_sub_voucher_check_dibatalkan on public.petty_cash_sub_voucher;
create trigger on_petty_cash_sub_voucher_check_dibatalkan
  before update of status on public.petty_cash_sub_voucher
  for each row execute function public.check_petty_cash_sub_voucher_dibatalkan();

-- Pengajuan/Voucher "Dibatalkan" bersifat final utk non-admin. Tanpa ini,
-- approver yang jalur approval-nya masih "pending" bisa saja meng-approve
-- dokumen yang sudah dibatalkan (RLS update approver cuma cek keberadaan
-- dia di `approvals`, tidak cek status). Admin tetap boleh lewat Override.
create or replace function public.check_petty_cash_dibatalkan_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'Dibatalkan'
    and new.status is distinct from 'Dibatalkan'
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  then
    raise exception 'Dokumen ini sudah dibatalkan dan tidak bisa diproses lagi.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_pengajuan_check_dibatalkan on public.petty_cash_pengajuan;
create trigger on_petty_cash_pengajuan_check_dibatalkan
  before update of status on public.petty_cash_pengajuan
  for each row execute function public.check_petty_cash_dibatalkan_final();

drop trigger if exists on_petty_cash_voucher_check_dibatalkan on public.petty_cash_voucher;
create trigger on_petty_cash_voucher_check_dibatalkan
  before update of status on public.petty_cash_voucher
  for each row execute function public.check_petty_cash_dibatalkan_final();

-- ============================================================
-- 4. Approval Deklarasi wajib ada Finance
-- ============================================================

create or replace function public._pc_approval_path_has_finance(p_path jsonb)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(p_path, '[]'::jsonb)) a
    where a->>'department' = 'Finance'
  );
$$;

create or replace function public.check_pc_approval_template_finance()
returns trigger
language plpgsql
as $$
begin
  if new.approval_type = 'Approval Deklarasi'
    and not public._pc_approval_path_has_finance(new.approval_path)
  then
    raise exception 'Template "Approval Deklarasi" wajib memiliki minimal 1 approver dari departemen Finance.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_pc_approval_templates_check_finance on public.pc_approval_templates;
create trigger on_pc_approval_templates_check_finance
  before insert or update of approval_type, approval_path on public.pc_approval_templates
  for each row execute function public.check_pc_approval_template_finance();

-- Jaring pengaman utk template lama yang belum diperbaiki: Deklarasi baru
-- ditolak kalau jalur approval-nya tidak memuat Finance.
create or replace function public.check_petty_cash_deklarasi_finance()
returns trigger
language plpgsql
as $$
begin
  if not public._pc_approval_path_has_finance(new.approvals) then
    raise exception 'Jalur Approval Deklarasi wajib memiliki minimal 1 approver dari departemen Finance - minta GA/Admin melengkapi Template Approval Deklarasi.';
  end if;
  return new;
end;
$$;

drop trigger if exists on_petty_cash_deklarasi_check_finance on public.petty_cash_deklarasi;
create trigger on_petty_cash_deklarasi_check_finance
  before insert on public.petty_cash_deklarasi
  for each row execute function public.check_petty_cash_deklarasi_finance();
