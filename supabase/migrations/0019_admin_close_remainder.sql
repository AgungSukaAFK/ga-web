-- 0019_admin_close_remainder.sql
--
-- Aksi Admin fase 2: "Tutup Sisa PO" & "Tutup Sisa MR" - lihat
-- services/adminDocumentActionService.ts.
--
--  1. Kolom purchase_orders.closed_remainder (jsonb) - sisa barang PO yang
--     ditutup (tidak akan dikirim vendor): qty per barang, alasan, catatan
--     refund (wajib kalau PO sudah dibayar). Sisa ini tidak dihitung lagi
--     sebagai qty ter-PO (buildPoQtyBreakdown), dan receive_record PO-nya
--     disesuaikan (ordered_qty = received_qty) supaya PO bisa "Full
--     Received". Checklist penerimaan PO yang sudah ditutup terkunci.
--  2. admin_apply_document_action (0018) diperluas:
--     - p_pos[] boleh membawa closed_remainder / receive_record /
--       full_received_at (Tutup Sisa). Dicek ulang di server: PO harus sudah
--       punya receive_record, belum pernah ditutup, dan catatan refund wajib
--       kalau PO sudah dibayar.
--     - p_mr boleh membawa budget_refund (angka) - qty item MR yang
--       ditutup mengembalikan budget cost center sebesar estimasi harganya,
--       maksimal sebesar potongan bersih MR itu (lihat 0011/0018).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- 0018_admin_document_actions.sql. Script IDEMPOTENT.

alter table public.purchase_orders
  add column if not exists closed_remainder jsonb;

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
  v_budget_left numeric;
  v_refund record;
  v_amount numeric;
  v_prev_budget numeric;
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
    v_paid := v_po_row.dp_paid or v_po_row.bp_paid or exists (
      select 1
      from jsonb_array_elements(coalesce(v_po_row.approvals, '[]'::jsonb)) a
      where a->>'status' = 'approved'
        and (a->>'type' = 'Payment Validator'
             or a->>'userid' = '06122d13-9918-40ac-9034-41e849c5c3e2')
    );

    if v_new_status = 'Cancelled' and v_po_row.status <> 'Cancelled' then
      if v_po_row.receive_record is not null or v_po_row.goods_receipt is not null then
        raise exception 'Barang PO % sudah dicatat diterima - PO tidak bisa dibatalkan.',
          v_po_row.kode_po;
      end if;
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
    elsif v_po ? 'closed_remainder' then
      -- Tutup Sisa PO.
      if v_po_row.receive_record is null then
        raise exception 'PO % belum punya barang diterima - pakai Batalkan PO.',
          v_po_row.kode_po;
      end if;
      if v_po_row.closed_remainder is not null then
        raise exception 'DOC_CHANGED: Sisa PO % sudah pernah ditutup.', v_po_row.kode_po;
      end if;
      if v_paid and nullif(btrim(coalesce(v_po->'closed_remainder'->>'refund_note', '')), '') is null then
        raise exception 'PO % sudah dibayar - catatan refund / penyesuaian tagihan wajib diisi.',
          v_po_row.kode_po;
      end if;

      update public.purchase_orders
      set status = v_new_status,
          closed_remainder = (v_po->'closed_remainder')
            || jsonb_build_object('closed_by', v_actor, 'reason', v_reason,
                                  'closed_at', now()),
          receive_record = case when v_po ? 'receive_record' then v_po->'receive_record' else receive_record end,
          full_received_at = case
            when v_po ? 'full_received_at' and full_received_at is null
              then (v_po->>'full_received_at')::timestamptz
            else full_received_at end,
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

    -- Tutup Sisa: kembalikan budget sebesar estimasi qty yang ditutup,
    -- maksimal potongan bersih MR per cost center.
    v_budget_left := coalesce((p_mr->>'budget_refund')::numeric, 0);
    if v_budget_left > 0 then
      for v_refund in
        select cost_center_id, -sum(change_amount) as net
        from public.cost_center_history
        where mr_id = v_mr_row.id
        group by cost_center_id
        having sum(change_amount) < 0
        order by (cost_center_id = v_mr_row.cost_center_id) desc
      loop
        exit when v_budget_left <= 0;
        v_amount := least(v_budget_left, v_refund.net);

        select current_budget into v_prev_budget
        from public.cost_centers
        where id = v_refund.cost_center_id
        for update;
        if not found then
          continue;
        end if;

        update public.cost_centers
        set current_budget = v_prev_budget + v_amount,
            updated_at = now()
        where id = v_refund.cost_center_id;

        insert into public.cost_center_history
          (cost_center_id, mr_id, user_id, change_amount, previous_budget, new_budget, description)
        values
          (v_refund.cost_center_id, v_mr_row.id, v_actor, v_amount,
           v_prev_budget, v_prev_budget + v_amount,
           'Refund via Tutup Sisa MR: ' || v_mr_row.kode_mr);

        v_budget_left := v_budget_left - v_amount;
      end loop;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_apply_document_action(text, jsonb, jsonb) from public;
grant execute on function public.admin_apply_document_action(text, jsonb, jsonb) to authenticated;
