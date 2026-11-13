-- 0026_dashboard_insights_v2.sql
--
-- Revisi insight Dashboard (lanjutan 0025_dashboard_insights.sql):
--   * Identitas barang dibuat lebih akurat lewat dashboard_item_key():
--     baris MR/PO tanpa part_number (mis. diketik manual "padlock") sekarang
--     ikut digabung ke barang katalognya (via barang_id, atau nama yang cocok
--     persis & unik di master barang). Sebelumnya baris seperti ini terpisah
--     jadi item sendiri sehingga hitungan barang katalognya terlihat kecil.
--   * get_dashboard_top_items        : Top Barang (jumlah MR + qty MR + jumlah PO + qty PO)
--   * get_dashboard_item_detail      : detail 1 barang (daftar MR & PO) - popup
--   * get_dashboard_vendor_detail    : detail 1 vendor (daftar PO & barang) - popup
--   * get_dashboard_approval_detail  : detail waktu approval per approver + dokumen terlama - popup
--   * get_dashboard_top_po_items     : didefinisikan ulang pakai identitas barang baru
--     (signature sama dengan 0025, jadi cukup create or replace).
--
-- Filter company sama dengan 0025: LOURDES lihat semua; company lain lihat
-- miliknya sendiri + LOURDES. Semua fungsi SECURITY INVOKER (RLS tetap
-- berlaku). Script idempotent, aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- 0. Identitas barang
-- ---------------------------------------------------------------------------
-- Urutan: part_number baris -> part_number master dari barang_id -> part_number
-- master yang part_name-nya sama persis (case-insensitive) & unik -> barang_id
-- -> nama (lowercase).
create or replace function public.dashboard_item_key(
  p_part_number text,
  p_barang_id bigint,
  p_name text
)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    'PN:' || upper(nullif(trim(p_part_number), '')),
    (select 'PN:' || upper(nullif(trim(b.part_number), ''))
       from public.barang b where b.id = p_barang_id),
    (select 'PN:' || upper(min(trim(b.part_number)))
       from public.barang b
      where nullif(trim(p_name), '') is not null
        and lower(trim(b.part_name)) = lower(trim(p_name))
        and nullif(trim(b.part_number), '') is not null
     having count(distinct upper(trim(b.part_number))) = 1),
    'ID:' || p_barang_id::text,
    'NM:' || lower(nullif(trim(p_name), ''))
  );
$$;

-- Baris barang MR aktif pada periode (MR Rejected/Cancelled & baris
-- Cancelled/Replaced tidak dihitung). Periode = mr.created_at.
create or replace function public.dashboard_mr_lines(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  mr_id bigint,
  kode_mr text,
  department text,
  requester_id text,
  created_at timestamptz,
  mr_status text,
  line_status text,
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  qty numeric,
  uom text
)
language sql
stable
set search_path = public
as $$
  select
    x.mr_id, x.kode_mr, x.department, x.requester_id, x.created_at,
    x.mr_status, x.line_status,
    public.dashboard_item_key(x.part_number, x.barang_id, x.item_name) as item_key,
    x.barang_id, x.part_number, x.item_name, x.qty, x.uom
  from (
    select
      mr.id::bigint as mr_id,
      mr.kode_mr::text as kode_mr,
      mr.department::text as department,
      mr.userid::text as requester_id,
      mr.created_at,
      mr.status::text as mr_status,
      coalesce(o.elem->>'status', 'Pending') as line_status,
      case when (o.elem->>'barang_id') ~ '^\d+$'
           then (o.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(o.elem->>'part_number'), '') as part_number,
      nullif(trim(o.elem->>'name'), '') as item_name,
      case when trim(o.elem->>'qty') ~ '^-?\d+(\.\d+)?$'
           then trim(o.elem->>'qty')::numeric
           when trim(o.elem->>'qty') ~ '^-?\d+,\d+$'
           then replace(trim(o.elem->>'qty'), ',', '.')::numeric
           else 0 end as qty,
      nullif(trim(o.elem->>'uom'), '') as uom
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
  ) x
  where x.part_number is not null or x.barang_id is not null or x.item_name is not null;
$$;

-- Baris barang PO aktif pada periode (PO Rejected/Cancelled/Draft & non-IDR
-- tidak dihitung). Periode = po.created_at. Nilai baris = total_price
-- (fallback qty * price), sebelum pajak/diskon/ongkir level PO.
create or replace function public.dashboard_po_lines(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  po_id bigint,
  kode_po text,
  created_at timestamptz,
  po_status text,
  vendor_name text,
  po_total numeric,
  item_key text,
  barang_id bigint,
  part_number text,
  item_name text,
  qty numeric,
  price numeric,
  line_total numeric,
  uom text
)
language sql
stable
set search_path = public
as $$
  select
    x.po_id, x.kode_po, x.created_at, x.po_status, x.vendor_name, x.po_total,
    public.dashboard_item_key(x.part_number, x.barang_id, x.item_name) as item_key,
    x.barang_id, x.part_number, x.item_name, x.qty, x.price,
    coalesce(x.line_total, x.qty * x.price) as line_total,
    x.uom
  from (
    select
      po.id::bigint as po_id,
      po.kode_po::text as kode_po,
      po.created_at,
      po.status::text as po_status,
      coalesce(
        nullif(trim(po.vendor_details->>'nama_vendor'), ''),
        nullif(trim(po.vendor_details->>'name'), ''),
        nullif(trim(po.items->0->>'vendor_name'), ''),
        '(Tanpa vendor)'
      ) as vendor_name,
      coalesce(po.total_price, 0)::numeric as po_total,
      case when (i.elem->>'barang_id') ~ '^\d+$'
           then (i.elem->>'barang_id')::bigint end as barang_id,
      nullif(trim(i.elem->>'part_number'), '') as part_number,
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
  ) x
  where x.part_number is not null or x.barang_id is not null or x.item_name is not null;
$$;

-- Info master barang untuk 1 item_key 'PN:...' (nama & UoM katalog).
create or replace function public.dashboard_catalog_by_key(p_item_key text)
returns table (barang_id bigint, part_number text, part_name text, uom text)
language sql
stable
set search_path = public
as $$
  select b.id::bigint, b.part_number::text, b.part_name::text, nullif(trim(b.uom), '')::text
  from public.barang b
  where p_item_key like 'PN:%'
    and upper(trim(b.part_number)) = substr(p_item_key, 4)
  order by b.id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 1. Top Barang (MR + PO)
-- ---------------------------------------------------------------------------
-- Ranking = jumlah MR berbeda yang memuat barang, lalu total qty MR.
-- mr_uom / po_uom diisi kalau semua baris pakai satuan yang sama (case-
-- insensitive), selain itu null (= satuan campur).
create or replace function public.get_dashboard_top_items(
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
  uom text,
  mr_count bigint,
  mr_qty numeric,
  mr_uom text,
  department_count bigint,
  po_count bigint,
  po_qty numeric,
  po_uom text
)
language sql
stable
set search_path = public
as $$
  with mr as (
    select
      l.item_key,
      max(l.barang_id) as barang_id,
      max(l.part_number) as part_number,
      (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
      count(distinct l.mr_id) as mr_count,
      sum(l.qty) as mr_qty,
      case when count(distinct lower(l.uom)) = 1 then max(l.uom) end as mr_uom,
      count(distinct l.department) as department_count
    from public.dashboard_mr_lines(p_company_code, p_start_date, p_end_date) l
    group by l.item_key
    order by count(distinct l.mr_id) desc, sum(l.qty) desc
    limit greatest(coalesce(p_limit, 10), 1)
  ),
  po as (
    select
      l.item_key,
      count(distinct l.po_id) as po_count,
      sum(l.qty) as po_qty,
      case when count(distinct lower(l.uom)) = 1 then max(l.uom) end as po_uom
    from public.dashboard_po_lines(p_company_code, p_start_date, p_end_date) l
    where l.item_key in (select item_key from mr)
    group by l.item_key
  )
  select
    m.item_key,
    coalesce(c.barang_id, m.barang_id),
    coalesce(c.part_number, m.part_number),
    coalesce(nullif(trim(c.part_name), ''), m.item_name),
    coalesce(c.uom, m.mr_uom, p.po_uom),
    m.mr_count,
    m.mr_qty,
    m.mr_uom,
    m.department_count,
    coalesce(p.po_count, 0),
    coalesce(p.po_qty, 0),
    p.po_uom
  from mr m
  left join po p on p.item_key = m.item_key
  left join lateral public.dashboard_catalog_by_key(m.item_key) c on true
  order by m.mr_count desc, m.mr_qty desc;
$$;

-- ---------------------------------------------------------------------------
-- 2. Top barang di PO (berdasarkan nilai) - versi identitas barang baru
-- ---------------------------------------------------------------------------
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
  with g as (
    select
      l.item_key,
      max(l.barang_id) as barang_id,
      max(l.part_number) as part_number,
      (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
      count(distinct l.po_id) as po_count,
      sum(l.line_total) as total_value,
      sum(l.qty) as total_qty,
      case when count(distinct lower(l.uom)) = 1 then max(l.uom) end as uom
    from public.dashboard_po_lines(p_company_code, p_start_date, p_end_date) l
    group by l.item_key
    order by sum(l.line_total) desc
    limit greatest(coalesce(p_limit, 10), 1)
  )
  select
    g.item_key,
    coalesce(c.barang_id, g.barang_id),
    coalesce(c.part_number, g.part_number),
    coalesce(nullif(trim(c.part_name), ''), g.item_name),
    g.po_count,
    g.total_value,
    g.total_qty,
    g.uom
  from g
  left join lateral public.dashboard_catalog_by_key(g.item_key) c on true
  order by g.total_value desc;
$$;

-- ---------------------------------------------------------------------------
-- 3. Detail 1 barang (popup Top Barang & Belanja Terbesar)
-- ---------------------------------------------------------------------------
-- Mengembalikan jsonb:
--   { mr: [...baris MR], po: [...baris PO], departments: [{department, mr_count, qty}] }
-- Daftar dibatasi 300 baris terbaru supaya payload tetap kecil.
create or replace function public.get_dashboard_item_detail(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_item_key text
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with mr as (
    select l.*
    from public.dashboard_mr_lines(p_company_code, p_start_date, p_end_date) l
    where l.item_key = p_item_key
  ),
  po as (
    select l.*
    from public.dashboard_po_lines(p_company_code, p_start_date, p_end_date) l
    where l.item_key = p_item_key
  )
  select jsonb_build_object(
    'mr', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select mr.mr_id, mr.kode_mr, mr.department, mr.created_at, mr.mr_status,
               mr.line_status, mr.item_name, mr.qty, mr.uom,
               pr.nama as requester
        from mr
        left join public.profiles pr on pr.id::text = mr.requester_id
        order by mr.created_at desc
        limit 300
      ) r
    ), '[]'::jsonb),
    'po', coalesce((
      select jsonb_agg(r order by r.created_at desc)
      from (
        select po.po_id, po.kode_po, po.created_at, po.po_status, po.vendor_name,
               po.item_name, po.qty, po.uom, po.price, po.line_total
        from po
        order by po.created_at desc
        limit 300
      ) r
    ), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(d order by d.mr_count desc, d.qty desc)
      from (
        select coalesce(mr.department, '-') as department,
               count(distinct mr.mr_id) as mr_count,
               sum(mr.qty) as qty
        from mr
        group by 1
      ) d
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Detail 1 vendor (popup Top Vendor)
-- ---------------------------------------------------------------------------
-- p_vendor_name dicocokkan case-insensitive (sama dengan pengelompokan
-- get_dashboard_top_vendors). jsonb: { pos: [...], items: [...top 15 barang] }
create or replace function public.get_dashboard_vendor_detail(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_vendor_name text
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with pos as (
    select
      po.id::bigint as po_id,
      po.kode_po::text as kode_po,
      po.created_at,
      po.status::text as po_status,
      coalesce(po.total_price, 0)::numeric as total_price,
      jsonb_array_length(
        case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
      ) as item_count
    from public.purchase_orders po
    where po.created_at >= p_start_date
      and po.created_at <= p_end_date
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and coalesce(po.currency, 'IDR') = 'IDR'
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
      and upper(coalesce(
            nullif(trim(po.vendor_details->>'nama_vendor'), ''),
            nullif(trim(po.vendor_details->>'name'), ''),
            nullif(trim(po.items->0->>'vendor_name'), ''),
            '(Tanpa vendor)'
          )) = upper(trim(p_vendor_name))
  ),
  items as (
    select
      l.item_key,
      (array_agg(l.item_name order by l.created_at desc))[1] as item_name,
      max(l.part_number) as part_number,
      count(distinct l.po_id) as po_count,
      sum(l.qty) as qty,
      case when count(distinct lower(l.uom)) = 1 then max(l.uom) end as uom,
      sum(l.line_total) as total_value
    from public.dashboard_po_lines(p_company_code, p_start_date, p_end_date) l
    where l.po_id in (select po_id from pos)
    group by l.item_key
    order by sum(l.line_total) desc
    limit 15
  )
  select jsonb_build_object(
    'pos', coalesce((
      select jsonb_agg(p order by p.created_at desc)
      from (select * from pos order by created_at desc limit 300) p
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(i order by i.total_value desc) from items i
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Detail waktu approval (popup Rata-rata Waktu Approval)
-- ---------------------------------------------------------------------------
-- Dokumen dihitung dengan aturan yang sama dengan get_dashboard_approval_time
-- (semua step selesai approved, approval terakhir jatuh di periode; step
-- Payment Validator & Receiver tidak dihitung).
-- Durasi per step = processed_at step tsb - processed_at step sebelumnya
-- (step pertama: - created_at dokumen), urutan sesuai processed_at.
-- jsonb: { approvers: [{nama, step_type, step_count, avg_hours, max_hours}],
--          slowest:   [{id, kode, department, created_at, approved_at, hours}] }
create or replace function public.get_dashboard_approval_detail(
  p_company_code text,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_doc_type text
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with docs as (
    select mr.id::bigint as id, mr.kode_mr::text as kode, mr.department::text as department,
           mr.created_at, mr.approvals
    from public.material_requests mr
    where p_doc_type = 'MR'
      and mr.status not in ('Rejected', 'Cancelled')
      and (p_company_code = 'LOURDES' or mr.company_code in (p_company_code, 'LOURDES'))
    union all
    select po.id::bigint, po.kode_po::text, null::text, po.created_at, po.approvals
    from public.purchase_orders po
    where p_doc_type = 'PO'
      and po.status not in ('Rejected', 'Cancelled', 'Draft')
      and (p_company_code = 'LOURDES' or po.company_code in (p_company_code, 'LOURDES'))
  ),
  steps as (
    select
      d.id, d.kode, d.department, d.created_at,
      s.elem->>'status' as status,
      coalesce(nullif(trim(s.elem->>'nama'), ''), '(Tanpa nama)') as nama,
      coalesce(nullif(trim(s.elem->>'type'), ''), '-') as step_type,
      nullif(s.elem->>'processed_at', '')::timestamptz as processed_at
    from docs d
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(d.approvals) = 'array' then d.approvals else '[]'::jsonb end
    ) as s(elem)
    where coalesce(s.elem->>'type', '') not in ('Payment Validator', 'Receiver')
  ),
  done_docs as (
    select st.id, st.kode, st.department, st.created_at, max(st.processed_at) as approved_at
    from steps st
    group by st.id, st.kode, st.department, st.created_at
    having count(*) > 0
       and count(*) = count(*) filter (where st.status = 'approved' and st.processed_at is not null)
       and max(st.processed_at) >= p_start_date
       and max(st.processed_at) <= p_end_date
  ),
  step_durations as (
    select
      st.nama,
      st.step_type,
      greatest(extract(epoch from (
        st.processed_at - coalesce(
          lag(st.processed_at) over (partition by st.id order by st.processed_at),
          st.created_at
        )
      )) / 3600.0, 0) as hours
    from steps st
    where st.id in (select id from done_docs)
  )
  select jsonb_build_object(
    'approvers', coalesce((
      select jsonb_agg(a order by a.avg_hours desc)
      from (
        select sd.nama, sd.step_type,
               count(*) as step_count,
               round(avg(sd.hours)::numeric, 1) as avg_hours,
               round(max(sd.hours)::numeric, 1) as max_hours
        from step_durations sd
        group by sd.nama, sd.step_type
      ) a
    ), '[]'::jsonb),
    'slowest', coalesce((
      select jsonb_agg(s order by s.hours desc)
      from (
        select dd.id, dd.kode, dd.department, dd.created_at, dd.approved_at,
               round((greatest(extract(epoch from (dd.approved_at - dd.created_at)), 0) / 3600.0)::numeric, 1) as hours
        from done_docs dd
        order by dd.approved_at - dd.created_at desc
        limit 15
      ) s
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.dashboard_item_key(text, bigint, text) to authenticated;
grant execute on function public.dashboard_mr_lines(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_po_lines(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.dashboard_catalog_by_key(text) to authenticated;
grant execute on function public.get_dashboard_top_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_top_po_items(text, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_dashboard_item_detail(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_dashboard_vendor_detail(text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_dashboard_approval_detail(text, timestamptz, timestamptz, text) to authenticated;
