-- 0011_mr_budget_refund.sql
--
-- Budget Cost Center MR dipotong saat MR masuk "Waiting PO"
-- (handle_mr_budget_deduction, 0001_baseline.sql), tapi TIDAK PERNAH
-- dikembalikan kalau MR dimundurkan - mis. admin mengubah approval di MR
-- Management (Waiting PO -> Pending Approval / Rejected, lihat
-- services/adminApprovalOverrideService.ts). Akibatnya begitu MR itu
-- di-approve ulang, budget terpotong dua kali.
--
-- REPLACES handle_mr_budget_deduction (trigger
-- on_mr_status_change_update_budget tetap, cuma fungsinya yang diganti):
--  1. Masuk "Waiting PO" -> potong budget, KECUALI MR ini masih punya
--     potongan bersih (jumlah change_amount per mr_id < 0) - jadi approve
--     ulang / status manual ke Waiting PO tidak memotong dobel.
--  2. Turun dari Waiting PO (atau sesudahnya) ke status sebelum PO
--     (Pending Validation / On Hold / Pending Approval / Rejected) ->
--     kembalikan potongan bersih ke cost center yang dipotong (per
--     cost_center_id, jadi tetap benar walau cost center MR sempat diganti).
--
-- Idempotent - aman dijalankan ulang.

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
  v_pre_po_statuses text[] := array['Pending Validation', 'On Hold', 'Pending Approval', 'Rejected'];
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

  -- 2. MR dimundurkan ke tahap sebelum PO -> kembalikan potongan bersih.
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
