-- 0018_admin_document_actions.sql
--
-- Aksi Admin dokumen MR & PO (MR Management / PO Management): Batalkan MR,
-- Batalkan PO, Buka Kembali MR/PO - lihat services/adminDocumentActionService.ts.
-- Dulu admin "membatalkan" dokumen dengan mengubah approval/status manual
-- (jadi "Rejected"), yang dibatasi banyak aturan dan tidak melepas item MR.
--
--  1. Status dokumen baru "Cancelled" (MR & PO) + kolom jejak pembatalan:
--     cancelled_at / cancelled_by / cancel_reason / cancelled_from_status
--     (status sebelum dibatalkan, dipakai "Buka Kembali"), PO juga
--     refund_note (wajib kalau PO sudah dibayar saat dibatalkan).
--  2. Budget Cost Center: "Cancelled" ikut dianggap status sebelum PO, jadi
--     MR yang dibatalkan dari "Waiting PO" ke atas mengembalikan potongan
--     budget-nya (sebesar yang dipotong dari MR). Dibuka kembali lalu masuk
--     "Waiting PO" lagi = dipotong lagi (sekali, lihat 0011).
--  3. RPC admin_apply_document_action - menulis semua perubahan satu aksi
--     (MR + PO-PO terkait) dalam SATU transaksi. Perhitungannya (item MR
--     yang dilepas, status MR berikutnya) dilakukan di client; RPC ini
--     memastikan pemanggil admin, dokumen belum berubah sejak preview, dan
--     mengecek ulang aturan pembatalan (alasan wajib, catatan refund wajib
--     utk PO yang sudah dibayar, PO yang barangnya sudah diterima tidak bisa
--     dibatalkan).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0017_announcer_tts.sql. Script IDEMPOTENT.

-- 1) Kolom jejak pembatalan ------------------------------------------------

alter table public.material_requests
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text,
  add column if not exists cancelled_from_status text;

alter table public.purchase_orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancel_reason text,
  add column if not exists cancelled_from_status text,
  add column if not exists refund_note text;

-- 2) Budget Cost Center: "Cancelled" = status sebelum PO -------------------
-- Sama persis dengan 0011, cuma v_pre_po_statuses ditambah 'Cancelled'.

create or replace function public.handle_mr_budget_deduction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mr_cost_estimation numeric;
  previous_budget_val numeric;
  new_budget_val numeric;
  v_net_deducted numeric;
  v_refund record;
  v_pre_po_statuses text[] := array['Pending Validation', 'On Hold', 'Pending Approval', 'Rejected', 'Cancelled'];
begin
  -- 1. Status berubah MENJADI "Waiting PO" -> potong budget (sekali per MR).
  if new.status = 'Waiting PO' and old.status is distinct from 'Waiting PO' then
    mr_cost_estimation := cast(new.cost_estimation as numeric);

    if new.cost_center_id is null or mr_cost_estimation is null or mr_cost_estimation <= 0 then
      raise warning 'MR % disetujui tanpa Cost Center ID atau Estimasi Biaya.', new.kode_mr;
      return new;
    end if;

    select coalesce(sum(change_amount), 0) into v_net_deducted
    from public.cost_center_history
    where mr_id = new.id;

    if v_net_deducted < 0 then
      return new;
    end if;

    -- Lock baris cost center untuk mencegah race condition.
    select current_budget into previous_budget_val
    from public.cost_centers
    where id = new.cost_center_id
    for update;

    new_budget_val := previous_budget_val - mr_cost_estimation;

    update public.cost_centers
    set current_budget = new_budget_val,
        updated_at = now()
    where id = new.cost_center_id;

    insert into public.cost_center_history
      (cost_center_id, mr_id, user_id, change_amount, previous_budget, new_budget, description)
    values
      (new.cost_center_id, new.id, new.userid, -mr_cost_estimation,
       previous_budget_val, new_budget_val,
       'Deduction via MR Approval: ' || new.kode_mr);

    return new;
  end if;

  -- 2. MR dimundurkan / dibatalkan ke tahap sebelum PO -> kembalikan
  -- potongan bersih.
  if new.status = any(v_pre_po_statuses)
     and not (old.status = any(v_pre_po_statuses)) then
    for v_refund in
      select cost_center_id, -sum(change_amount) as amount
      from public.cost_center_history
      where mr_id = new.id
      group by cost_center_id
      having sum(change_amount) < 0
    loop
      select current_budget into previous_budget_val
      from public.cost_centers
      where id = v_refund.cost_center_id
      for update;

      if not found then
        continue;
      end if;

      new_budget_val := previous_budget_val + v_refund.amount;

      update public.cost_centers
      set current_budget = new_budget_val,
          updated_at = now()
      where id = v_refund.cost_center_id;

      insert into public.cost_center_history
        (cost_center_id, mr_id, user_id, change_amount, previous_budget, new_budget, description)
      values
        (v_refund.cost_center_id, new.id, coalesce(auth.uid(), new.userid), v_refund.amount,
         previous_budget_val, new_budget_val,
         'Refund via MR Rollback: ' || new.kode_mr || ' (' || old.status || ' -> ' || new.status || ')');
    end loop;
  end if;

  return new;
end;
$$;

-- 3) RPC aksi admin ----------------------------------------------------------
--
-- p_mr  : null, atau { id, expected_status, expected_orders, status, orders? }
-- p_pos : array { id, expected_status, status, approvals?, dp_paid?, bp_paid?,
--                 refund_note? }
-- expected_* = nilai saat preview dibuka; beda = dokumen sudah diubah orang
-- lain -> ditolak (client minta admin muat ulang).
-- Status baru "Cancelled" mengisi jejak pembatalan; keluar dari "Cancelled"
-- (Buka Kembali) mengosongkannya - riwayatnya tetap ada di activity_logs.

create or replace function public.admin_apply_document_action(
  p_reason text,
  p_mr jsonb,
  p_pos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_po jsonb;
  v_po_row public.purchase_orders%rowtype;
  v_mr_row public.material_requests%rowtype;
  v_new_status text;
  v_paid boolean;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_actor and p.role = 'admin'
  ) then
    raise exception 'Hanya admin yang boleh menjalankan aksi ini.';
  end if;
  if v_reason is null then
    raise exception 'Alasan wajib diisi.';
  end if;

  -- PO dulu, lalu MR (urutan lock konsisten).
  for v_po in select * from jsonb_array_elements(coalesce(p_pos, '[]'::jsonb))
  loop
    select * into v_po_row
    from public.purchase_orders
    where id = (v_po->>'id')::bigint
    for update;

    if not found then
      raise exception 'PO % tidak ditemukan.', v_po->>'id';
    end if;
    if v_po_row.status is distinct from v_po->>'expected_status' then
      raise exception 'DOC_CHANGED: PO % sudah berubah (status sekarang "%").',
        v_po_row.kode_po, v_po_row.status;
    end if;

    v_new_status := v_po->>'status';

    if v_new_status = 'Cancelled' and v_po_row.status <> 'Cancelled' then
      if v_po_row.receive_record is not null or v_po_row.goods_receipt is not null then
        raise exception 'Barang PO % sudah dicatat diterima - PO tidak bisa dibatalkan.',
          v_po_row.kode_po;
      end if;

      v_paid := v_po_row.dp_paid or v_po_row.bp_paid or exists (
        select 1
        from jsonb_array_elements(coalesce(v_po_row.approvals, '[]'::jsonb)) a
        where a->>'status' = 'approved'
          and (a->>'type' = 'Payment Validator'
               or a->>'userid' = '06122d13-9918-40ac-9034-41e849c5c3e2')
      );
      if v_paid and nullif(btrim(coalesce(v_po->>'refund_note', '')), '') is null then
        raise exception 'PO % sudah dibayar - catatan refund wajib diisi.',
          v_po_row.kode_po;
      end if;

      update public.purchase_orders
      set status = 'Cancelled',
          cancelled_at = now(),
          cancelled_by = v_actor,
          cancel_reason = v_reason,
          cancelled_from_status = v_po_row.status,
          refund_note = nullif(btrim(coalesce(v_po->>'refund_note', '')), ''),
          updated_at = now()
      where id = v_po_row.id;
    else
      update public.purchase_orders
      set status = v_new_status,
          approvals = case when v_po ? 'approvals' then v_po->'approvals' else approvals end,
          dp_paid = case when v_po ? 'dp_paid' then (v_po->>'dp_paid')::boolean else dp_paid end,
          bp_paid = case when v_po ? 'bp_paid' then (v_po->>'bp_paid')::boolean else bp_paid end,
          cancelled_at = case when v_po_row.status = 'Cancelled' then null else cancelled_at end,
          cancelled_by = case when v_po_row.status = 'Cancelled' then null else cancelled_by end,
          cancel_reason = case when v_po_row.status = 'Cancelled' then null else cancel_reason end,
          cancelled_from_status = case when v_po_row.status = 'Cancelled' then null else cancelled_from_status end,
          refund_note = case when v_po_row.status = 'Cancelled' then null else refund_note end,
          updated_at = now()
      where id = v_po_row.id;
    end if;
  end loop;

  if p_mr is not null then
    select * into v_mr_row
    from public.material_requests
    where id = (p_mr->>'id')::bigint
    for update;

    if not found then
      raise exception 'MR % tidak ditemukan.', p_mr->>'id';
    end if;
    if v_mr_row.status is distinct from p_mr->>'expected_status'
       or (p_mr ? 'expected_orders'
           and coalesce(v_mr_row.orders::jsonb, 'null'::jsonb)
               is distinct from p_mr->'expected_orders') then
      raise exception 'DOC_CHANGED: MR % sudah berubah sejak halaman dibuka.',
        v_mr_row.kode_mr;
    end if;

    v_new_status := p_mr->>'status';

    update public.material_requests
    set status = v_new_status,
        orders = case when p_mr ? 'orders' then (p_mr->'orders')::json else orders end,
        cancelled_at = case
          when v_new_status = 'Cancelled' and v_mr_row.status <> 'Cancelled' then now()
          when v_mr_row.status = 'Cancelled' and v_new_status <> 'Cancelled' then null
          else cancelled_at end,
        cancelled_by = case
          when v_new_status = 'Cancelled' and v_mr_row.status <> 'Cancelled' then v_actor
          when v_mr_row.status = 'Cancelled' and v_new_status <> 'Cancelled' then null
          else cancelled_by end,
        cancel_reason = case
          when v_new_status = 'Cancelled' and v_mr_row.status <> 'Cancelled' then v_reason
          when v_mr_row.status = 'Cancelled' and v_new_status <> 'Cancelled' then null
          else cancel_reason end,
        cancelled_from_status = case
          when v_new_status = 'Cancelled' and v_mr_row.status <> 'Cancelled' then v_mr_row.status
          when v_mr_row.status = 'Cancelled' and v_new_status <> 'Cancelled' then null
          else cancelled_from_status end
    where id = v_mr_row.id;
  end if;
end;
$$;

revoke all on function public.admin_apply_document_action(text, jsonb, jsonb) from public;
grant execute on function public.admin_apply_document_action(text, jsonb, jsonb) to authenticated;
