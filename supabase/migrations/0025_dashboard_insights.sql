-- 0025_dashboard_insights.sql
--
-- RPC untuk 4 insight baru di Dashboard (planning-dashboard-insight.md):
--   1. get_dashboard_top_mr_items  : barang paling sering diminta di MR + stok GA
--   2. get_dashboard_top_po_items  : barang dengan nilai belanja PO terbesar
--   3. get_dashboard_top_vendors   : vendor dengan nilai belanja PO terbesar
--   4. get_dashboard_approval_time : rata-rata & median waktu approval MR / PO
--
-- Filter company sama dengan applyCompanyScope di services/dashboardService.ts:
-- LOURDES lihat semua; company lain lihat miliknya sendiri + LOURDES.
-- Semua fungsi SECURITY INVOKER (default) supaya RLS tetap berlaku.
-- Script idempotent (create or replace), aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- 1. Top barang di MR
-- ---------------------------------------------------------------------------
-- Ranking = jumlah MR berbeda yang berisi barang tsb (BUKAN jumlah qty, karena
-- satuan/UOM tiap MR bisa beda). Barang dikelompokkan per part_number; kalau
-- kosong, per barang_id; kalau kosong juga, per nama (lowercase).
create or replace function public.get_dashboard_top_mr_items(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  mr_count bigint,
  line_count bigint,
  department_count bigint,
  in_catalog boolean,
  stock_qty numeric
)
language sql
stable
set search_path = public
as $$
  with lines as (
    select
      mr.id as mr_id,
      mr.department,
      mr.created_at,
      nullif(trim(o.elem->>'part_number'), '') as part_number,
      case when (o.elem->>'barang_id') ~ '^\d+$'
           then (o.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(o.elem->>'name'), '') as item_name
    from public.material_requests mr
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(mr.orders::jsonb) = 'array'
           then mr.orders::jsonb else '[]'::jsonb end
    ) as o(elem)
    where mr.created_at >= p_start_date
      and mr.created_at <= p_end_date
      and mr.status not in ('Rejected', 'Cancelled')
      and coalesce(o.elem->>'status', 'Pending') not in ('Cancelled', 'Replaced')
      and (p_company_code = 'LOURDES' or mr.company_code in (p_company_code, 'LOURDES'))
  ),
  grouped as (
    select
      coalesce('PN:' || upper(l.part_number),
               'ID:' || l.barang_id::text,
               'NM:' || lower(l.item_name)) as item_key,
      max(l.barang_id) as barang_id,
      max(l.part_number) as part_number,
      (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
      count(distinct l.mr_id) as mr_count,
      count(*) as line_count,
      count(distinct l.department) as department_count
    from lines l
    where l.part_number is not null or l.barang_id is not null or l.item_name is not null
    group by 1
    order by count(distinct l.mr_id) desc, count(*) desc
    limit greatest(coalesce(p_limit, 10), 1)
  )
  select
    g.item_key,
    g.barang_id,
    g.part_number,
    g.item_name,
    g.mr_count,
    g.line_count,
    g.department_count,
    (g.barang_id is not null) as in_catalog,
    case when g.barang_id is null then null else (
      select coalesce(sum(s.quantity), 0)
      from public.ga_stocks s
      where s.barang_id = g.barang_id
        and (p_company_code = 'LOURDES' or s.company_code = p_company_code)
    ) end as stock_qty
  from grouped g
  order by g.mr_count desc, g.line_count desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Top barang di PO (berdasarkan nilai)
-- ---------------------------------------------------------------------------
-- Nilai = jumlah items[].total_price (fallback qty * price), SEBELUM pajak/
-- diskon/ongkir level PO. Hanya PO bermata uang IDR supaya tidak tercampur.
-- uom diisi kalau semua baris barang tsb pakai satuan yang sama, selain itu null.
create or replace function public.get_dashboard_top_po_items(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  po_count bigint,
  total_value numeric,
  total_qty numeric,
  uom text
)
language sql
stable
set search_path = public
as $$
  with lines as (
    select
      po.id as po_id,
      po.created_at,
      nullif(trim(i.elem->>'part_number'), '') as part_number,
      case when (i.elem->>'barang_id') ~ '^\d+$'
           then (i.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(i.elem->>'name'), '') as item_name,
      case when (i.elem->>'qty') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'qty')::numeric else 0 end as qty,
      case when (i.elem->>'price') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'price')::numeric else 0 end as price,
      case when (i.elem->>'total_price') ~ '^-?\d+(\.\d+)?$'
           then (i.elem->>'total_price')::numeric end as line_total,
      nullif(trim(i.elem->>'uom'), '') as uom
    from public.purchase_orders po
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
    ) as i(elem)
    where po.created_at >= p_start_date
      and po.created_at <= p_end_date
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and coalesce(po.currency, 'IDR') = 'IDR'
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  )
  select
    coalesce('PN:' || upper(l.part_number),
             'ID:' || l.barang_id::text,
             'NM:' || lower(l.item_name)) as item_key,
    max(l.barang_id) as barang_id,
    max(l.part_number) as part_number,
    (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
    count(distinct l.po_id) as po_count,
    sum(coalesce(l.line_total, l.qty * l.price)) as total_value,
    sum(l.qty) as total_qty,
    case when count(distinct l.uom) = 1 then max(l.uom) end as uom
  from lines l
  where l.part_number is not null or l.barang_id is not null or l.item_name is not null
  group by 1
  order by sum(coalesce(l.line_total, l.qty * l.price)) desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- 3. Top vendor (berdasarkan nilai belanja)
-- ---------------------------------------------------------------------------
-- Nilai = purchase_orders.total_price (SUDAH termasuk pajak/diskon/ongkir).
-- Nama vendor: vendor_details.nama_vendor (format baru) -> vendor_details.name
-- (format lama) -> items[0].vendor_name -> '(Tanpa vendor)'.
create or replace function public.get_dashboard_top_vendors(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
)
returns table (
  vendor_name text,
  po_count bigint,
  total_value numeric,
  last_po_at timestamptz
)
language sql
stable
set search_path = public
as $$
  with pos as (
    select
      po.id,
      po.created_at,
      coalesce(po.total_price, 0) as total_price,
      coalesce(
        nullif(trim(po.vendor_details->>'nama_vendor'), ''),
        nullif(trim(po.vendor_details->>'name'), ''),
        nullif(trim(po.items->0->>'vendor_name'), ''),
        '(Tanpa vendor)'
      ) as vendor_name
    from public.purchase_orders po
    where po.created_at >= p_start_date
      and po.created_at <= p_end_date
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and coalesce(po.currency, 'IDR') = 'IDR'
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  )
  select
    (array_agg(p.vendor_name order by p.created_at desc))[1] as vendor_name,
    count(*) as po_count,
    sum(p.total_price) as total_value,
    max(p.created_at) as last_po_at
  from pos p
  group by upper(p.vendor_name)
  order by sum(p.total_price) desc
  limit greatest(coalesce(p_limit, 10), 1);
$$;

-- ---------------------------------------------------------------------------
-- 4. Rata-rata waktu approval
-- ---------------------------------------------------------------------------
-- Waktu approval = dari dokumen dibuat (created_at) sampai step approval
-- TERAKHIR di-approve (max approvals[].processed_at).
-- Step "Payment Validator" & "Receiver" TIDAK dihitung (itu tahap bayar &
-- terima barang, bukan approval).
-- Dokumen dihitung hanya kalau SEMUA step approval-nya sudah approved dan
-- punya processed_at. Filter periode pakai waktu approval terakhir (bukan
-- created_at), supaya dokumen yang dibuat di akhir periode dan belum selesai
-- tidak membuat rata-rata bias.
-- Selalu mengembalikan 2 baris: 'MR' dan 'PO' (angka null kalau tidak ada data).
create or replace function public.get_dashboard_approval_time(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  doc_type text,
  doc_count bigint,
  avg_hours numeric,
  median_hours numeric
)
language sql
stable
set search_path = public
as $$
  with docs as (
    select 'MR'::text as doc_type, mr.id, mr.created_at, mr.approvals
    from public.material_requests mr
    where mr.status not in ('Rejected', 'Cancelled')
      and (p_company_code = 'LOURDES' or mr.company_code in (p_company_code, 'LOURDES'))
    union all
    select 'PO'::text, po.id, po.created_at, po.approvals
    from public.purchase_orders po
    where po.status not in ('Rejected', 'Cancelled', 'Draft')
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  ),
  per_doc as (
    select
      d.doc_type,
      d.id,
      d.created_at,
      count(*) as step_count,
      count(*) filter (
        where s.elem->>'status' = 'approved'
          and nullif(s.elem->>'processed_at', '') is not null
      ) as done_count,
      max(nullif(s.elem->>'processed_at', '')::timestamptz) as approved_at
    from docs d
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.approvals) = 'array' then d.approvals else '[]'::jsonb end
    ) as s(elem)
    where coalesce(s.elem->>'type', '') not in ('Payment Validator', 'Receiver')
    group by d.doc_type, d.id, d.created_at
  ),
  done as (
    select
      p.doc_type,
      greatest(extract(epoch from (p.approved_at - p.created_at)) / 3600.0, 0) as hours
    from per_doc p
    where p.step_count > 0
      and p.done_count = p.step_count
      and p.approved_at >= p_start_date
      and p.approved_at <= p_end_date
  )
  select
    t.doc_type,
    count(d.hours) as doc_count,
    round(avg(d.hours)::numeric, 1) as avg_hours,
    round((percentile_cont(0.5) within group (order by d.hours))::numeric, 1) as median_hours
  from (values ('MR'), ('PO')) as t(doc_type)
  left join done d on d.doc_type = t.doc_type
  group by t.doc_type
  order by t.doc_type;
$$;

grant execute on function public.get_dashboard_top_mr_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_top_po_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_top_vendors(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_approval_time(text, timestamptz, timestamptz) to authenticated;
