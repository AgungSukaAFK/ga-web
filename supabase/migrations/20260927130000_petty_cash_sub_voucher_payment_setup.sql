-- Rombak Tarik Dana (Sub-Voucher) Petty Cash:
--  1. Tarikan sekarang berbasis CHECKLIST ITEM per-qty (bukan nominal bebas)
--     - `create_petty_cash_sub_voucher` diganti signature-nya, terima
--       `p_draws jsonb` (array {item_index, qty}) menggantikan `p_amount`.
--       `item_index` = posisi array di `petty_cash_voucher.items` asalnya -
--       AMAN dijadikan referensi permanen karena Voucher tidak bisa lagi
--       diedit item-nya begitu status "Approved" (satu-satunya jalan edit,
--       editAndApproveVoucherStep, cuma bisa dipanggil selagi approval masih
--       berjalan). Qty boleh di-split ke beberapa tarikan berbeda.
--  2. Sub-Voucher yang baru dibuat BELUM berarti dana diterima - status awal
--     berubah dari 'Aktif' jadi 'Menunggu Pembayaran'. Finance (department
--     'Finance' + role 'approver', atau admin) menyelesaikan pembayaran
--     lewat RPC baru `mark_petty_cash_sub_voucher_paid`, WAJIB sertakan
--     bukti transfer (`payment_proof`) - baru setelah itu status 'Selesai'.
--  3. Tambah panel diskusi (kolom `discussions` + RPC
--     `add_petty_cash_sub_voucher_discussion`) - menyamakan Sub-Voucher
--     dengan 3 dokumen Petty Cash lain yang sudah punya diskusi (lihat
--     petty-cash-discussion-rpc-setup.sql & lanjutannya).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SETELAH
-- petty-cash-sub-voucher-setup.sql, petty-cash-budget-setup.sql, &
-- petty-cash-deklarasi-sub-voucher-setup.sql.

-- ============================================================
-- 1. Kolom baru + migrasi nilai status lama
-- ============================================================

alter table public.petty_cash_sub_voucher
  add column if not exists items jsonb not null default '[]',
  add column if not exists payment_proof jsonb not null default '[]',
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid references public.profiles(id) on delete set null,
  add column if not exists discussions jsonb not null default '[]';

update public.petty_cash_sub_voucher
set status = 'Menunggu Pembayaran'
where status = 'Aktif';

alter table public.petty_cash_sub_voucher
  alter column status set default 'Menunggu Pembayaran';

-- ============================================================
-- 2. Tarik Dana berbasis item/qty (ganti signature)
-- ============================================================

-- Drop dulu versi lama (signature beda - `p_amount numeric` -> `p_draws
-- jsonb` bukan overload yang kompatibel, `create or replace` menolak ganti
-- nama parameter kalau tipe returnnya identik tapi daftar argumennya beda).
drop function if exists public.create_petty_cash_sub_voucher(bigint, text, bigint, numeric, text);

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

  v_items := v_voucher.items;

  -- Total qty yang sudah ditarik per item_index dari sub-voucher yang sudah
  -- ada punya Voucher ini - dihitung DALAM transaksi yang sama setelah lock
  -- baris Voucher di atas, jadi race-safe (tarikan lain thd Voucher yang
  -- sama akan antre menunggu lock ini dilepas).
  select coalesce(jsonb_object_agg(item_index, total_qty), '{}'::jsonb)
  into v_drawn_map
  from (
    select (elem->>'item_index')::int as item_index, sum((elem->>'qty')::numeric) as total_qty
    from public.petty_cash_sub_voucher sv, jsonb_array_elements(sv.items) elem
    where sv.voucher_id = p_voucher_id
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

    -- Update running map supaya kalau item_index yang sama dikirim 2x dalam
    -- SATU request, batas sisanya tetap kehitung benar (bukan cuma dicek
    -- terhadap data lama sebelum request ini).
    v_drawn_map := jsonb_set(v_drawn_map, array[v_idx::text], to_jsonb(v_already_drawn + v_qty));
  end loop;

  select coalesce(sum(amount), 0) into v_already_total
  from public.petty_cash_sub_voucher
  where voucher_id = p_voucher_id;

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

-- ============================================================
-- 3. Penyelesaian pembayaran Finance (RPC baru)
-- ============================================================

-- SECURITY DEFINER, self-check otorisasi di dalam fungsi (bukan lewat RLS)
-- karena tidak ada policy UPDATE langsung ke tabel ini SENGAJA (sama alasan
-- dengan tidak adanya policy INSERT langsung, lihat petty-cash-sub-voucher-setup.sql).
create or replace function public.mark_petty_cash_sub_voucher_paid(
  p_id bigint,
  p_payment_proof jsonb
)
returns public.petty_cash_sub_voucher
language plpgsql
security definer
set search_path = public
as $$
declare
  v_department text;
  v_role text;
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

  if p_payment_proof is null or jsonb_typeof(p_payment_proof) <> 'array' or jsonb_array_length(p_payment_proof) = 0 then
    raise exception 'Bukti transfer/pembayaran wajib dilampirkan.';
  end if;

  update public.petty_cash_sub_voucher
  set status = 'Selesai',
      payment_proof = p_payment_proof,
      paid_at = now(),
      paid_by = auth.uid(),
      updated_at = now()
  where id = p_id
    and status = 'Menunggu Pembayaran'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Sub-Voucher tidak ditemukan atau sudah selesai dibayar.';
  end if;

  return v_row;
end;
$$;

grant execute on function public.mark_petty_cash_sub_voucher_paid(bigint, jsonb) to authenticated;

-- ============================================================
-- 4. Diskusi Sub-Voucher (samakan dgn 3 dokumen lain)
-- ============================================================

create or replace function public.add_petty_cash_sub_voucher_discussion(
  p_id bigint,
  p_message text,
  p_content jsonb default null,
  p_mentions jsonb default '[]'::jsonb,
  p_attachment jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if trim(coalesce(p_message, '')) = '' and p_content is null and p_attachment is null then
    raise exception 'Pesan tidak boleh kosong.';
  end if;

  select coalesce(nama, email, 'Unknown User') into v_name
  from public.profiles where id = auth.uid();

  update public.petty_cash_sub_voucher
  set discussions = coalesce(discussions, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'user_id', auth.uid(),
      'user_name', v_name,
      'message', p_message,
      'content', p_content,
      'mentions', coalesce(p_mentions, '[]'::jsonb),
      'attachment', p_attachment,
      'timestamp', now()
    )
  )
  where id = p_id;
end;
$$;

grant execute on function public.add_petty_cash_sub_voucher_discussion(bigint, text, jsonb, jsonb, jsonb) to authenticated;
