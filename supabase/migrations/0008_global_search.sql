-- 0008_global_search.sql
--
-- Global search di top bar (components/topbar/topbar-search.tsx).
--
--   global_search(q, limit)       cari MR, PO, Petty Cash, Barang, Vendor &
--                                 User (khusus admin) dalam 1 panggilan,
--                                 maks. `limit` baris per grup.
--   global_search_pending(limit)  dokumen yang sedang menunggu approval user
--                                 yang login (sudah gilirannya) - tampilan
--                                 awal saat kotak search masih kosong.
--
-- Kenapa 1 RPC (bukan query per tabel dari browser): cukup 1 request per
-- ketikan (setelah debounce), cuma kolom ringan yang dikirim (tanpa JSON
-- items/orders), dan batas company bisa dijaga di satu tempat. RLS MR/PO/
-- Petty Cash masih `using (true)` - pembatasan company selama ini cuma di
-- halaman list (MaterialRequestClient.tsx, purchase-order/page.tsx), jadi
-- search menerapkan aturan yang sama supaya tidak menampilkan dokumen yang di
-- list disembunyikan:
--   LOURDES   -> semua company
--   GMI / GIS -> company sendiri + LOURDES
--   lainnya   -> company sendiri
-- Dokumen milik sendiri / yang user ikut jadi approver selalu tampil.
-- Petty Cash: pemilik, approver di dokumennya, atau admin / GA / Finance
-- (dengan batas company yang sama).
--
-- Pencocokan: tiap kata di query harus ada (urutan bebas, tidak peka huruf
-- besar/kecil). Urutan hasil: kode persis sama -> nomor urut di akhir kode
-- sama (ketik "435" -> .../435) -> cocok di kode -> terbaru.
--
-- Fungsi SECURITY INVOKER (RLS tetap berlaku). Script IDEMPOTENT.

-- ============================================================
-- 1. Index trigram (ILIKE '%...%')
-- ============================================================
-- Ekspresinya harus sama persis dengan yang dipakai di global_search()
-- supaya index-nya kepakai. Tabel Petty Cash & profiles masih kecil, belum
-- perlu index.

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_material_requests_search_trgm
  on public.material_requests
  using gin ((kode_mr || ' ' || coalesce(remarks, '')) extensions.gin_trgm_ops);

create index if not exists idx_purchase_orders_search_trgm
  on public.purchase_orders
  using gin ((
    kode_po || ' ' || coalesce(vendor_details ->> 'nama_vendor', '')
      || ' ' || coalesce(vendor_details ->> 'kode_vendor', '')
  ) extensions.gin_trgm_ops);

create index if not exists idx_purchase_orders_mr_id
  on public.purchase_orders (mr_id);

create index if not exists idx_barang_search_trgm
  on public.barang
  using gin ((part_number || ' ' || coalesce(part_name, '')) extensions.gin_trgm_ops);

create index if not exists idx_vendors_search_trgm
  on public.vendors
  using gin ((
    kode_vendor || ' ' || nama_vendor || ' ' || coalesce(pic_contact_person, '')
  ) extensions.gin_trgm_ops);

-- ============================================================
-- 2. Helper: giliran approval
-- ============================================================
-- Sama dengan isMyApprovalTurn (lib/pcApprovalFlow.ts) &
-- fetchMyPendingMrApprovals (services/approvalService.ts): step "pending"
-- pertama milik user, dan semua step sebelumnya sudah "approved".

create or replace function public.approval_is_my_turn(
  p_approvals jsonb,
  p_uid uuid
)
returns boolean
language sql
immutable
set search_path = public
as $$
  with steps as (
    select e.ord, e.step ->> 'userid' as uid, e.step ->> 'status' as st
      from jsonb_array_elements(
             case when jsonb_typeof(p_approvals) = 'array'
                  then p_approvals else '[]'::jsonb end
           ) with ordinality as e(step, ord)
  ),
  mine as (
    select min(ord) as ord from steps
     where uid = p_uid::text and st = 'pending'
  )
  select coalesce(
    (select mine.ord is not null
            and not exists (
              select 1 from steps
               where steps.ord < mine.ord
                 and steps.st is distinct from 'approved'
            )
       from mine),
    false
  );
$$;

-- ============================================================
-- 3. global_search
-- ============================================================

create or replace function public.global_search(
  p_query text,
  p_limit int default 5
)
returns table (
  kind text,         -- mr | po | pc_pengajuan | pc_voucher | pc_sub_voucher
                     -- | pc_deklarasi | barang | vendor | user
  id text,
  title text,        -- kode dokumen / nama barang / nama vendor / nama user
  subtitle text,
  status text,
  company text,
  amount numeric,
  created_at timestamptz,
  exact boolean,     -- kode/part number/email persis sama dengan query
  ref text           -- kode utk tautan (vendor: kode_vendor), selain itu null
)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_q text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 10);
  v_esc text;
  v_words text[];
  v_tokens text[];   -- '%kata%' per kata, terpanjang duluan
  v_main text;       -- kata terpanjang (dipakai index trigram)
  v_prefix text;     -- 'query%'
  v_suffix text;     -- '%/kataTerakhir' (nomor urut di akhir kode)
  v_me jsonb;        -- pola "user ini ada di approvals"
  v_role text;
  v_dept text;
  v_company text;
  v_scope text[];    -- null = semua company
  v_pc_all boolean;
  v_people uuid[];   -- user yang namanya cocok (cari dokumen by pemohon)
  v_mr_ids bigint[]; -- MR yang kodenya persis query (utk tampilkan PO-nya)
begin
  if v_uid is null or char_length(v_q) < 2 then
    return;
  end if;

  select p.role, p.department, p.company
    into v_role, v_dept, v_company
    from public.profiles p
   where p.id = v_uid;

  v_scope := case
    when v_company = 'LOURDES' then null
    when v_company in ('GMI', 'GIS') then array[v_company, 'LOURDES']
    when v_company is not null then array[v_company]
    else array[]::text[]
  end;
  v_pc_all := v_role = 'admin'
    or v_dept in ('General Affair', 'HRGA-HSE', 'Finance');
  v_me := jsonb_build_array(jsonb_build_object('userid', v_uid::text));

  -- Escape karakter wildcard LIKE supaya "%" / "_" di query dicari apa adanya.
  v_esc := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  v_words := string_to_array(v_esc, ' ');
  select coalesce(array_agg('%' || w || '%' order by char_length(w) desc), array[]::text[])
    into v_tokens
    from (select distinct w from unnest(v_words) as w where w <> '' limit 5) s;
  if cardinality(v_tokens) = 0 then
    return;
  end if;
  v_main := v_tokens[1];
  v_prefix := v_esc || '%';
  v_suffix := '%/' || v_words[array_upper(v_words, 1)];

  v_people := array(
    select pr.id from public.profiles pr
     where coalesce(pr.nama, '') ilike all (v_tokens)
     limit 30
  );
  v_mr_ids := array(
    select m.id from public.material_requests m
     where m.kode_mr = upper(v_q)
  );

  -- Material Request
  return query
  select 'mr'::text, m.id::text, m.kode_mr,
         concat_ws(' · ', p.nama, nullif(m.department, '')),
         m.status, m.company_code, null::numeric, m.created_at,
         lower(m.kode_mr) = lower(v_q), null::text
    from public.material_requests m
    left join public.profiles p on p.id = m.userid
   where ((m.kode_mr || ' ' || coalesce(m.remarks, '')) ilike v_main
          and (m.kode_mr || ' ' || coalesce(m.remarks, '')) ilike all (v_tokens)
          or m.userid = any (v_people))
     and (v_scope is null or m.company_code = any (v_scope)
          or m.userid = v_uid or m.approvals @> v_me)
   order by lower(m.kode_mr) = lower(v_q) desc,
            m.kode_mr ilike v_suffix desc,
            m.kode_mr ilike all (v_tokens) desc,
            m.created_at desc
   limit v_limit;

  -- Purchase Order (juga PO dari MR yang kodenya persis diketik)
  return query
  select 'po'::text, po.id::text, po.kode_po,
         coalesce(nullif(po.vendor_details ->> 'nama_vendor', ''), 'Vendor belum dipilih'),
         po.status, po.company_code, po.total_price, po.created_at,
         lower(po.kode_po) = lower(v_q), null::text
    from public.purchase_orders po
   where ((po.kode_po || ' ' || coalesce(po.vendor_details ->> 'nama_vendor', '')
            || ' ' || coalesce(po.vendor_details ->> 'kode_vendor', '')) ilike v_main
          and (po.kode_po || ' ' || coalesce(po.vendor_details ->> 'nama_vendor', '')
            || ' ' || coalesce(po.vendor_details ->> 'kode_vendor', '')) ilike all (v_tokens)
          or po.user_id = any (v_people)
          or po.mr_id = any (v_mr_ids))
     and (v_scope is null or po.company_code = any (v_scope)
          or po.user_id = v_uid or po.approvals @> v_me)
   order by lower(po.kode_po) = lower(v_q) desc,
            po.kode_po ilike v_suffix desc,
            po.kode_po ilike all (v_tokens) desc,
            po.created_at desc
   limit v_limit;

  -- Petty Cash (pengajuan, voucher, sub-voucher, deklarasi digabung 1 grup)
  return query
  with pc as (
    select 'pc_pengajuan'::text as kind, x.id, x.kode_pengajuan as kode,
           x.user_id, x.department, x.status, x.company_code,
           x.total_amount as amount, x.created_at
      from public.petty_cash_pengajuan x
     where (x.kode_pengajuan ilike all (v_tokens) or x.user_id = any (v_people))
       and (x.user_id = v_uid or x.approvals @> v_me
            or (v_pc_all and (v_scope is null or x.company_code = any (v_scope))))
    union all
    select 'pc_voucher', x.id, x.kode_voucher, x.user_id, x.department,
           x.status, x.company_code, x.total_amount, x.created_at
      from public.petty_cash_voucher x
     where (x.kode_voucher ilike all (v_tokens) or x.user_id = any (v_people))
       and (x.user_id = v_uid or x.approvals @> v_me
            or (v_pc_all and (v_scope is null or x.company_code = any (v_scope))))
    union all
    select 'pc_sub_voucher', s.id, s.kode_sub_voucher, s.user_id, v.department,
           s.status, v.company_code, s.amount, s.created_at
      from public.petty_cash_sub_voucher s
      join public.petty_cash_voucher v on v.id = s.voucher_id
     where (s.kode_sub_voucher ilike all (v_tokens) or s.user_id = any (v_people))
       and (s.user_id = v_uid
            or (v_pc_all and (v_scope is null or v.company_code = any (v_scope))))
    union all
    select 'pc_deklarasi', x.id, x.kode_deklarasi, x.user_id, x.department,
           x.status, x.company_code, x.total_amount, x.created_at
      from public.petty_cash_deklarasi x
     where (x.kode_deklarasi ilike all (v_tokens) or x.user_id = any (v_people))
       and (x.user_id = v_uid or x.approvals @> v_me
            or (v_pc_all and (v_scope is null or x.company_code = any (v_scope))))
  )
  select pc.kind, pc.id::text, pc.kode,
         concat_ws(' · ', p.nama, nullif(pc.department, '')),
         pc.status, pc.company_code, pc.amount, pc.created_at,
         lower(pc.kode) = lower(v_q), null::text
    from pc
    left join public.profiles p on p.id = pc.user_id
   order by lower(pc.kode) = lower(v_q) desc,
            pc.kode ilike v_suffix desc,
            pc.kode ilike all (v_tokens) desc,
            pc.created_at desc
   limit v_limit;

  -- Barang
  return query
  select 'barang'::text, b.id::text,
         coalesce(nullif(btrim(b.part_name), ''), b.part_number),
         concat_ws(' · ', b.part_number, nullif(b.category, ''), nullif(b.uom, '')),
         null::text, null::text, null::numeric, b.created_at,
         lower(b.part_number) = lower(v_q), null::text
    from public.barang b
   where (b.part_number || ' ' || coalesce(b.part_name, '')) ilike v_main
     and (b.part_number || ' ' || coalesce(b.part_name, '')) ilike all (v_tokens)
   order by lower(b.part_number) = lower(v_q) desc,
            b.part_number ilike v_prefix desc,
            b.part_name ilike v_prefix desc nulls last,
            char_length(b.part_name),
            b.part_name
   limit v_limit;

  -- Vendor
  return query
  select 'vendor'::text, v.id::text, v.nama_vendor,
         concat_ws(' · ', v.kode_vendor, nullif(v.pic_contact_person, '')),
         null::text, null::text, null::numeric, v.created_at,
         lower(v.kode_vendor) = lower(v_q), v.kode_vendor
    from public.vendors v
   where (v.kode_vendor || ' ' || v.nama_vendor || ' ' || coalesce(v.pic_contact_person, '')) ilike v_main
     and (v.kode_vendor || ' ' || v.nama_vendor || ' ' || coalesce(v.pic_contact_person, '')) ilike all (v_tokens)
   order by lower(v.kode_vendor) = lower(v_q) desc,
            v.nama_vendor ilike v_prefix desc,
            v.nama_vendor
   limit v_limit;

  -- User (khusus admin - sama dengan menu User Management)
  if v_role = 'admin' then
    return query
    select 'user'::text, pr.id::text,
           coalesce(nullif(btrim(pr.nama), ''), pr.email),
           -- NRP ikut ditampilkan: query angka bisa cocok ke NRP.
           concat_ws(' · ', pr.email, nullif(pr.nrp, ''), nullif(pr.department, ''), nullif(pr.company, '')),
           case when not pr.is_active then 'Nonaktif' end,
           pr.company, null::numeric, pr.created_at,
           coalesce(lower(pr.email) = lower(v_q) or lower(pr.nrp) = lower(v_q), false),
           null::text
      from public.profiles pr
     where (coalesce(pr.nama, '') || ' ' || coalesce(pr.email, '') || ' ' || coalesce(pr.nrp, ''))
           ilike all (v_tokens)
     order by coalesce(lower(pr.email) = lower(v_q) or lower(pr.nrp) = lower(v_q), false) desc,
              pr.nama ilike v_prefix desc nulls last,
              pr.is_active desc,
              pr.nama
     limit v_limit;
  end if;
end;
$$;

-- ============================================================
-- 4. global_search_pending
-- ============================================================
-- Status antrian sama dengan halaman approval: MR "Pending Approval", PO
-- "Pending Approval"/"Pending Payment" (fetchMyPendingPoApprovals), Petty
-- Cash "In Approval". `total_mr_po` / `total_pc` = jumlah SEMUA dokumen yang
-- menunggu (bukan cuma yang dikirim), utk tautan "Lihat semua" ke
-- /approval-validation & /petty-cash/approval.

create or replace function public.global_search_pending(p_limit int default 5)
returns table (
  kind text,
  id text,
  title text,
  subtitle text,
  status text,
  company text,
  amount numeric,
  created_at timestamptz,
  total_mr_po bigint,
  total_pc bigint
)
language sql
stable
set search_path = public
as $$
  with me as (
    select auth.uid() as uid,
           jsonb_build_array(jsonb_build_object(
             'userid', auth.uid()::text, 'status', 'pending'
           )) as pat
  ),
  docs as (
    select 'mr'::text as kind, m.id::text as id, m.kode_mr as title,
           m.userid as user_id, m.department, m.status, m.company_code,
           null::numeric as amount, m.created_at, m.approvals
      from public.material_requests m, me
     where m.status = 'Pending Approval' and m.approvals @> me.pat
    union all
    select 'po', po.id::text, po.kode_po, po.user_id,
           po.vendor_details ->> 'nama_vendor', po.status, po.company_code,
           po.total_price, po.created_at, po.approvals
      from public.purchase_orders po, me
     where po.status in ('Pending Approval', 'Pending Payment')
       and po.approvals @> me.pat
    union all
    select 'pc_pengajuan', x.id::text, x.kode_pengajuan, x.user_id,
           x.department, x.status, x.company_code, x.total_amount,
           x.created_at, x.approvals
      from public.petty_cash_pengajuan x, me
     where x.status = 'In Approval' and x.approvals @> me.pat
    union all
    select 'pc_voucher', x.id::text, x.kode_voucher, x.user_id,
           x.department, x.status, x.company_code, x.total_amount,
           x.created_at, x.approvals
      from public.petty_cash_voucher x, me
     where x.status = 'In Approval' and x.approvals @> me.pat
    union all
    select 'pc_deklarasi', x.id::text, x.kode_deklarasi, x.user_id,
           x.department, x.status, x.company_code, x.total_amount,
           x.created_at, x.approvals
      from public.petty_cash_deklarasi x, me
     where x.status = 'In Approval' and x.approvals @> me.pat
  ),
  mine as (
    select d.*,
           count(*) filter (where d.kind in ('mr', 'po')) over () as total_mr_po,
           count(*) filter (where d.kind like 'pc\_%') over () as total_pc
      from docs d, me
     where public.approval_is_my_turn(d.approvals, me.uid)
  )
  -- Terbaru di atas - antrian lama yang terbengkalai tidak menutupi yang
  -- baru masuk; daftar lengkap tetap di halaman approval.
  select mine.kind, mine.id, mine.title,
         -- PO: nama vendor; lainnya: pemohon · departemen
         case when mine.kind = 'po'
              then concat_ws(' · ', nullif(mine.department, ''), p.nama)
              else concat_ws(' · ', p.nama, nullif(mine.department, ''))
         end,
         mine.status, mine.company_code, mine.amount, mine.created_at,
         mine.total_mr_po, mine.total_pc
    from mine
    left join public.profiles p on p.id = mine.user_id
   order by mine.created_at desc
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.approval_is_my_turn(jsonb, uuid) from public;
revoke all on function public.global_search(text, int) from public;
revoke all on function public.global_search_pending(int) from public;
grant execute on function public.approval_is_my_turn(jsonb, uuid) to authenticated;
grant execute on function public.global_search(text, int) to authenticated;
grant execute on function public.global_search_pending(int) to authenticated;
