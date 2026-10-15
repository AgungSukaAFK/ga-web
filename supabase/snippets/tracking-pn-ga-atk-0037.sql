-- ============================================================================
-- Tracking pembelian berdasarkan Part Number - GA-ATK-0037
-- Semua MR & PO, SEMUA status (termasuk Draft / Rejected / Cancelled).
--
-- Cara pakai di Supabase SQL Editor: SQL Editor cuma menampilkan hasil query
-- TERAKHIR yang dijalankan, jadi blok + jalankan (Cmd+Enter) per bagian
-- [1]..[6]. Ganti PN cukup di CTE `params` tiap bagian (cari 'GA-ATK-0037').
--
--   [1] Overview 1 baris: semua nomor MR & PO terkait + total qty/nilai
--   [2] Master barang
--   [3] Detail per item MR + daftar PO yang memenuhi item tsb
--   [4] Detail per item PO (history pembelian) + daftar MR terkait
--   [5] Timeline MR -> PO -> Terima (1 baris per pasangan MR-PO)
--   [6] Ringkasan per status / vendor + daftar nomor dokumen
--
-- Matching barang (kolom `match_via`):
--   - part_number   : part_number sama (case-insensitive, trim)
--   - barang_id     : barang_id sama dengan master barang PN ini
--   - konversi      : item MR yang dulu PN lain lalu dikonversi ke PN ini
--                     (orders[].conversion_history), dan baris PO yang masih
--                     pakai PN lama (kept_old_po_kode)
--   - manual link MR: baris PO yang di-link manual dari item MR
--                     (orders[].manual_po_links, barang substitusi) - dipilih
--                     baris yang qty-nya sama dengan qty link (atau PO 1 item).
-- "PO aktif" = status selain Draft / Rejected / Cancelled.
-- Kolom yang ditambah lewat migrasi dibaca via to_jsonb(row)->>'kolom' supaya
-- query tidak error kalau migrasinya belum jalan di DB tsb.
--
-- CTE params / barang_ids / mr_items / conv_old / po_items sama persis di
-- tiap bagian (SQL Editor tidak bisa share CTE antar query).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- [1] Overview 1 baris: semua nomor MR & PO terkait
-- ----------------------------------------------------------------------------
with params as (
  select lower(trim('GA-ATK-0037')) as pn
),
barang_ids as (
  select b.id from public.barang b, params p
  where lower(trim(b.part_number)) = p.pn
),
mr_items as (
  select
    mr.*,
    o.item,
    o.ord::int as item_index,
    req.nama as requester,
    req.email as requester_email,
    case
      when lower(trim(o.item->>'part_number')) = p.pn then 'part_number'
      when o.item->>'barang_id' ~ '^[0-9]+$'
        and (o.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      else 'konversi'
    end as match_via,
    coalesce(o.item->>'status', 'Pending') as item_status,
    public.safe_numeric(o.item->>'qty') as qty_diminta,
    public.safe_numeric(o.item->>'estimasi_harga') as estimasi_harga,
    (
      select coalesce(sum(public.safe_numeric(sf->>'qty')), 0)
      from json_array_elements(
        case when json_typeof(o.item->'stock_fulfillments') = 'array'
          then o.item->'stock_fulfillments' else '[]'::json end
      ) sf
    ) as qty_stok_ga,
    array(
      select json_array_elements_text(
        case when json_typeof(o.item->'po_refs') = 'array'
          then o.item->'po_refs' else '[]'::json end
      )
    ) as po_refs,
    array(
      select ml->>'kode_po'
      from json_array_elements(
        case when json_typeof(o.item->'manual_po_links') = 'array'
          then o.item->'manual_po_links' else '[]'::json end
      ) ml
    ) as manual_po_codes
  from public.material_requests mr
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) with ordinality as o(item, ord)
  left join public.profiles req on req.id = mr.userid
  where lower(trim(o.item->>'part_number')) = p.pn
     or (o.item->>'barang_id' ~ '^[0-9]+$'
         and (o.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1
       from json_array_elements(
         case when json_typeof(o.item->'conversion_history') = 'array'
           then o.item->'conversion_history' else '[]'::json end
       ) ch
       where lower(trim(ch->>'from_part_number')) = p.pn
          or lower(trim(ch->>'to_part_number')) = p.pn
     )
),
conv_old as (
  select distinct lower(trim(ch->>'from_part_number')) as old_pn, k.kode_po
  from mr_items m
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(m.item->'conversion_history') = 'array'
      then m.item->'conversion_history' else '[]'::json end
  ) ch
  cross join lateral json_array_elements_text(
    case when json_typeof(ch->'kept_old_po_kode') = 'array'
      then ch->'kept_old_po_kode' else '[]'::json end
  ) as k(kode_po)
  where lower(trim(ch->>'to_part_number')) = p.pn
),
po_items as (
  select
    po.*,
    it.item,
    it.ord::int as item_index,
    case
      when lower(trim(it.item->>'part_number')) = p.pn then 'part_number'
      when it.item->>'barang_id' ~ '^[0-9]+$'
        and (it.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      when exists (
        select 1 from conv_old c
        where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
      ) then 'konversi (PN lama)'
      else 'manual link MR'
    end as match_via,
    po.status not in ('Draft', 'Rejected', 'Cancelled', 'Canceled') as is_aktif,
    coalesce(nullif(trim(po.vendor_details->>'nama_vendor'), ''),
             nullif(trim(po.vendor_details->>'name'), ''),
             nullif(trim(it.item->>'vendor_name'), '')) as vendor,
    po.vendor_details->>'kode_vendor' as kode_vendor,
    public.safe_numeric(it.item->>'qty') as qty_po,
    public.safe_numeric(it.item->>'price') as harga,
    coalesce(public.safe_numeric(it.item->>'total_price'),
             public.safe_numeric(it.item->>'qty') * public.safe_numeric(it.item->>'price')) as subtotal,
    (
      select public.safe_numeric(rr->>'received_qty')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'receive_record'->'items') = 'array'
          then to_jsonb(po)->'receive_record'->'items' else '[]'::jsonb end
      ) rr
      where lower(trim(rr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_diterima,
    to_jsonb(po)->'receive_record'->>'received_by_name' as diterima_oleh,
    (to_jsonb(po)->'receive_record'->>'received_at')::timestamptz as diterima_at,
    (
      select public.safe_numeric(gr->>'qty_received')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'goods_receipt'->'items') = 'array'
          then to_jsonb(po)->'goods_receipt'->'items' else '[]'::jsonb end
      ) gr
      where lower(trim(gr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_goods_receipt,
    to_jsonb(po)->'goods_receipt'->>'receiver_name' as gr_receiver,
    (to_jsonb(po)->'goods_receipt'->>'confirmed_at')::timestamptz as gr_confirmed_at,
    (to_jsonb(po)->>'full_received_at')::timestamptz as po_full_received_at,
    buyer.nama as dibuat_oleh
  from public.purchase_orders po
  cross join params p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) with ordinality as it(item, ord)
  left join public.profiles buyer on buyer.id = po.user_id
  where lower(trim(it.item->>'part_number')) = p.pn
     or (it.item->>'barang_id' ~ '^[0-9]+$'
         and (it.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1 from conv_old c
       where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
     )
     or exists (
       -- Manual link: hanya baris PO yang qty-nya sama dengan qty link
       -- (atau PO-nya cuma 1 item), supaya item lain di PO tsb tidak ikut.
       select 1
       from mr_items m
       cross join lateral json_array_elements(
         case when json_typeof(m.item->'manual_po_links') = 'array'
           then m.item->'manual_po_links' else '[]'::json end
       ) ml
       where ml->>'kode_po' = po.kode_po
         and (public.safe_numeric(ml->>'qty') = public.safe_numeric(it.item->>'qty')
              or jsonb_array_length(po.items) = 1)
     )
)
select
  (select string_agg(distinct format('%s - %s (%s)', b.part_number, b.part_name, b.uom), '; ')
     from public.barang b, params p where lower(trim(b.part_number)) = p.pn) as barang,
  (select count(distinct id) from mr_items)                                 as jumlah_mr,
  (select string_agg(distinct format('%s [%s]', kode_mr, status), ', ')
     from mr_items)                                                         as daftar_mr,
  (select sum(qty_diminta) from mr_items
     where status not in ('Rejected', 'Cancelled', 'Canceled')
       and item_status not in ('Cancelled', 'Replaced'))                    as total_qty_diminta_aktif,
  (select sum(qty_stok_ga) from mr_items)                                   as total_qty_dari_stok_ga,
  (select count(distinct id) from po_items)                                 as jumlah_po,
  (select string_agg(distinct format('%s [%s]', kode_po, status), ', ')
     from po_items)                                                         as daftar_po,
  (select string_agg(distinct kode_po, ', ') from po_items where is_aktif) as daftar_po_aktif,
  (select sum(qty_po) from po_items where is_aktif)                         as total_qty_po_aktif,
  (select sum(qty_diterima) from po_items where is_aktif)                   as total_qty_diterima,
  (select sum(subtotal) from po_items where is_aktif)                       as total_nilai_po_aktif,
  (select string_agg(distinct vendor, ', ') from po_items where is_aktif)   as daftar_vendor,
  (select min(harga) filter (where harga > 0) from po_items where is_aktif) as harga_min,
  (select max(harga) from po_items where is_aktif)                          as harga_max,
  (select format('%s @ %s - %s (%s)', kode_po, harga, vendor, created_at::date)
     from po_items where is_aktif and harga > 0
     order by created_at desc limit 1)                                      as pembelian_terakhir,
  (select format('%s (%s)', kode_mr, created_at::date)
     from mr_items order by created_at limit 1)                             as mr_pertama,
  (select format('%s (%s)', kode_mr, created_at::date)
     from mr_items order by created_at desc limit 1)                        as mr_terakhir;


-- ----------------------------------------------------------------------------
-- [2] Master barang
-- ----------------------------------------------------------------------------
with params as (select lower(trim('GA-ATK-0037')) as pn)
select b.*
from public.barang b, params p
where lower(trim(b.part_number)) = p.pn;


-- ----------------------------------------------------------------------------
-- [3] Detail per item MR + daftar PO yang memenuhi item tsb
-- ----------------------------------------------------------------------------
with params as (
  select lower(trim('GA-ATK-0037')) as pn
),
barang_ids as (
  select b.id from public.barang b, params p
  where lower(trim(b.part_number)) = p.pn
),
mr_items as (
  select
    mr.*,
    o.item,
    o.ord::int as item_index,
    req.nama as requester,
    req.email as requester_email,
    case
      when lower(trim(o.item->>'part_number')) = p.pn then 'part_number'
      when o.item->>'barang_id' ~ '^[0-9]+$'
        and (o.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      else 'konversi'
    end as match_via,
    coalesce(o.item->>'status', 'Pending') as item_status,
    public.safe_numeric(o.item->>'qty') as qty_diminta,
    public.safe_numeric(o.item->>'estimasi_harga') as estimasi_harga,
    (
      select coalesce(sum(public.safe_numeric(sf->>'qty')), 0)
      from json_array_elements(
        case when json_typeof(o.item->'stock_fulfillments') = 'array'
          then o.item->'stock_fulfillments' else '[]'::json end
      ) sf
    ) as qty_stok_ga,
    array(
      select json_array_elements_text(
        case when json_typeof(o.item->'po_refs') = 'array'
          then o.item->'po_refs' else '[]'::json end
      )
    ) as po_refs,
    array(
      select ml->>'kode_po'
      from json_array_elements(
        case when json_typeof(o.item->'manual_po_links') = 'array'
          then o.item->'manual_po_links' else '[]'::json end
      ) ml
    ) as manual_po_codes
  from public.material_requests mr
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) with ordinality as o(item, ord)
  left join public.profiles req on req.id = mr.userid
  where lower(trim(o.item->>'part_number')) = p.pn
     or (o.item->>'barang_id' ~ '^[0-9]+$'
         and (o.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1
       from json_array_elements(
         case when json_typeof(o.item->'conversion_history') = 'array'
           then o.item->'conversion_history' else '[]'::json end
       ) ch
       where lower(trim(ch->>'from_part_number')) = p.pn
          or lower(trim(ch->>'to_part_number')) = p.pn
     )
),
conv_old as (
  select distinct lower(trim(ch->>'from_part_number')) as old_pn, k.kode_po
  from mr_items m
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(m.item->'conversion_history') = 'array'
      then m.item->'conversion_history' else '[]'::json end
  ) ch
  cross join lateral json_array_elements_text(
    case when json_typeof(ch->'kept_old_po_kode') = 'array'
      then ch->'kept_old_po_kode' else '[]'::json end
  ) as k(kode_po)
  where lower(trim(ch->>'to_part_number')) = p.pn
),
po_items as (
  select
    po.*,
    it.item,
    it.ord::int as item_index,
    case
      when lower(trim(it.item->>'part_number')) = p.pn then 'part_number'
      when it.item->>'barang_id' ~ '^[0-9]+$'
        and (it.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      when exists (
        select 1 from conv_old c
        where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
      ) then 'konversi (PN lama)'
      else 'manual link MR'
    end as match_via,
    po.status not in ('Draft', 'Rejected', 'Cancelled', 'Canceled') as is_aktif,
    coalesce(nullif(trim(po.vendor_details->>'nama_vendor'), ''),
             nullif(trim(po.vendor_details->>'name'), ''),
             nullif(trim(it.item->>'vendor_name'), '')) as vendor,
    po.vendor_details->>'kode_vendor' as kode_vendor,
    public.safe_numeric(it.item->>'qty') as qty_po,
    public.safe_numeric(it.item->>'price') as harga,
    coalesce(public.safe_numeric(it.item->>'total_price'),
             public.safe_numeric(it.item->>'qty') * public.safe_numeric(it.item->>'price')) as subtotal,
    (
      select public.safe_numeric(rr->>'received_qty')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'receive_record'->'items') = 'array'
          then to_jsonb(po)->'receive_record'->'items' else '[]'::jsonb end
      ) rr
      where lower(trim(rr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_diterima,
    to_jsonb(po)->'receive_record'->>'received_by_name' as diterima_oleh,
    (to_jsonb(po)->'receive_record'->>'received_at')::timestamptz as diterima_at,
    (
      select public.safe_numeric(gr->>'qty_received')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'goods_receipt'->'items') = 'array'
          then to_jsonb(po)->'goods_receipt'->'items' else '[]'::jsonb end
      ) gr
      where lower(trim(gr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_goods_receipt,
    to_jsonb(po)->'goods_receipt'->>'receiver_name' as gr_receiver,
    (to_jsonb(po)->'goods_receipt'->>'confirmed_at')::timestamptz as gr_confirmed_at,
    (to_jsonb(po)->>'full_received_at')::timestamptz as po_full_received_at,
    buyer.nama as dibuat_oleh
  from public.purchase_orders po
  cross join params p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) with ordinality as it(item, ord)
  left join public.profiles buyer on buyer.id = po.user_id
  where lower(trim(it.item->>'part_number')) = p.pn
     or (it.item->>'barang_id' ~ '^[0-9]+$'
         and (it.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1 from conv_old c
       where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
     )
     or exists (
       -- Manual link: hanya baris PO yang qty-nya sama dengan qty link
       -- (atau PO-nya cuma 1 item), supaya item lain di PO tsb tidak ikut.
       select 1
       from mr_items m
       cross join lateral json_array_elements(
         case when json_typeof(m.item->'manual_po_links') = 'array'
           then m.item->'manual_po_links' else '[]'::json end
       ) ml
       where ml->>'kode_po' = po.kode_po
         and (public.safe_numeric(ml->>'qty') = public.safe_numeric(it.item->>'qty')
              or jsonb_array_length(po.items) = 1)
     )
)
select
  m.id                                      as mr_id,
  m.kode_mr,
  m.created_at                              as mr_created_at,
  m.due_date,
  m.status                                  as mr_status,
  m.level                                   as mr_level,
  m.prioritas,
  m.kategori,
  m.company_code,
  m.department,
  m.tujuan_site,
  coalesce(cc.name, m.cost_center)          as cost_center,
  m.requester,
  m.requester_email,
  m.item_index,
  m.match_via,
  m.item->>'part_number'                    as part_number,
  m.item->>'name'                           as item_name,
  m.qty_diminta,
  m.item->>'uom'                            as uom,
  m.estimasi_harga,
  m.qty_diminta * m.estimasi_harga          as estimasi_total,
  m.item_status,
  m.item->>'level'                          as item_level,
  m.item->>'status_note'                    as item_status_note,
  -- PO terkait item ini (via mr_id, po_refs, atau manual link)
  array_to_string(m.po_refs, ', ')          as po_refs_tercatat_di_mr,
  array_to_string(m.manual_po_codes, ', ')  as po_manual_link,
  po.jumlah_po,
  po.daftar_po,
  po.qty_po_aktif,
  po.qty_diterima,
  po.nilai_po_aktif,
  m.qty_stok_ga                             as qty_dari_stok_ga,
  greatest(coalesce(m.qty_diminta, 0) - coalesce(po.qty_po_aktif, 0) - m.qty_stok_ga, 0)
                                            as sisa_belum_di_po,
  -- Item lain di MR yang sama
  (
    select string_agg(format('%s - %s (%s %s) [%s]',
             coalesce(x->>'part_number', '-'), x->>'name', x->>'qty', x->>'uom',
             coalesce(x->>'status', 'Pending')), E'\n')
    from json_array_elements(
      case when json_typeof(m.orders) = 'array' then m.orders else '[]'::json end
    ) with ordinality as xo(x, n)
    where n <> m.item_index
  )                                         as item_lain_di_mr,
  (
    select string_agg(format('%s: %s - %s (%s)', a->>'type', a->>'nama', a->>'status',
             coalesce(a->>'processed_at', '-')), E'\n')
    from jsonb_array_elements(
      case when jsonb_typeof(m.approvals) = 'array' then m.approvals else '[]'::jsonb end
    ) a
  )                                         as mr_approvals,
  (
    select format('%s: %s', a->>'type', a->>'nama')
    from jsonb_array_elements(
      case when jsonb_typeof(m.approvals) = 'array' then m.approvals else '[]'::jsonb end
    ) a
    where a->>'status' = 'pending'
    limit 1
  )                                         as menunggu_approval,
  (to_jsonb(m)->>'full_received_at')::timestamptz as mr_full_received_at,
  m.item->'stock_fulfillments'              as stock_fulfillments,
  m.item->'delivery_info'                   as delivery_info,
  m.item->'conversion_history'              as conversion_history,
  m.item->>'note'                           as item_note,
  m.item->>'url'                            as item_url,
  public.mr_remarks_plain_text(m.remarks)   as mr_remarks
from mr_items m
left join public.cost_centers cc on cc.id = m.cost_center_id
left join lateral (
  select
    count(distinct pi.id) as jumlah_po,
    string_agg(
      format('%s [%s] %s | qty %s x %s = %s | diterima %s',
             pi.kode_po, pi.status, coalesce(pi.vendor, '-'),
             pi.qty_po, pi.harga, pi.subtotal, coalesce(pi.qty_diterima::text, '-')),
      E'\n' order by pi.created_at)                      as daftar_po,
    sum(pi.qty_po) filter (where pi.is_aktif)            as qty_po_aktif,
    sum(pi.qty_diterima) filter (where pi.is_aktif)      as qty_diterima,
    sum(pi.subtotal) filter (where pi.is_aktif)          as nilai_po_aktif
  from po_items pi
  where pi.mr_id = m.id
     or pi.kode_po = any(m.po_refs)
     or pi.kode_po = any(m.manual_po_codes)
) po on true
order by m.created_at desc, m.item_index;


-- ----------------------------------------------------------------------------
-- [4] Detail per item PO = HISTORY PEMBELIAN + daftar MR terkait
-- ----------------------------------------------------------------------------
with params as (
  select lower(trim('GA-ATK-0037')) as pn
),
barang_ids as (
  select b.id from public.barang b, params p
  where lower(trim(b.part_number)) = p.pn
),
mr_items as (
  select
    mr.*,
    o.item,
    o.ord::int as item_index,
    req.nama as requester,
    req.email as requester_email,
    case
      when lower(trim(o.item->>'part_number')) = p.pn then 'part_number'
      when o.item->>'barang_id' ~ '^[0-9]+$'
        and (o.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      else 'konversi'
    end as match_via,
    coalesce(o.item->>'status', 'Pending') as item_status,
    public.safe_numeric(o.item->>'qty') as qty_diminta,
    public.safe_numeric(o.item->>'estimasi_harga') as estimasi_harga,
    (
      select coalesce(sum(public.safe_numeric(sf->>'qty')), 0)
      from json_array_elements(
        case when json_typeof(o.item->'stock_fulfillments') = 'array'
          then o.item->'stock_fulfillments' else '[]'::json end
      ) sf
    ) as qty_stok_ga,
    array(
      select json_array_elements_text(
        case when json_typeof(o.item->'po_refs') = 'array'
          then o.item->'po_refs' else '[]'::json end
      )
    ) as po_refs,
    array(
      select ml->>'kode_po'
      from json_array_elements(
        case when json_typeof(o.item->'manual_po_links') = 'array'
          then o.item->'manual_po_links' else '[]'::json end
      ) ml
    ) as manual_po_codes
  from public.material_requests mr
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) with ordinality as o(item, ord)
  left join public.profiles req on req.id = mr.userid
  where lower(trim(o.item->>'part_number')) = p.pn
     or (o.item->>'barang_id' ~ '^[0-9]+$'
         and (o.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1
       from json_array_elements(
         case when json_typeof(o.item->'conversion_history') = 'array'
           then o.item->'conversion_history' else '[]'::json end
       ) ch
       where lower(trim(ch->>'from_part_number')) = p.pn
          or lower(trim(ch->>'to_part_number')) = p.pn
     )
),
conv_old as (
  select distinct lower(trim(ch->>'from_part_number')) as old_pn, k.kode_po
  from mr_items m
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(m.item->'conversion_history') = 'array'
      then m.item->'conversion_history' else '[]'::json end
  ) ch
  cross join lateral json_array_elements_text(
    case when json_typeof(ch->'kept_old_po_kode') = 'array'
      then ch->'kept_old_po_kode' else '[]'::json end
  ) as k(kode_po)
  where lower(trim(ch->>'to_part_number')) = p.pn
),
po_items as (
  select
    po.*,
    it.item,
    it.ord::int as item_index,
    case
      when lower(trim(it.item->>'part_number')) = p.pn then 'part_number'
      when it.item->>'barang_id' ~ '^[0-9]+$'
        and (it.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      when exists (
        select 1 from conv_old c
        where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
      ) then 'konversi (PN lama)'
      else 'manual link MR'
    end as match_via,
    po.status not in ('Draft', 'Rejected', 'Cancelled', 'Canceled') as is_aktif,
    coalesce(nullif(trim(po.vendor_details->>'nama_vendor'), ''),
             nullif(trim(po.vendor_details->>'name'), ''),
             nullif(trim(it.item->>'vendor_name'), '')) as vendor,
    po.vendor_details->>'kode_vendor' as kode_vendor,
    public.safe_numeric(it.item->>'qty') as qty_po,
    public.safe_numeric(it.item->>'price') as harga,
    coalesce(public.safe_numeric(it.item->>'total_price'),
             public.safe_numeric(it.item->>'qty') * public.safe_numeric(it.item->>'price')) as subtotal,
    (
      select public.safe_numeric(rr->>'received_qty')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'receive_record'->'items') = 'array'
          then to_jsonb(po)->'receive_record'->'items' else '[]'::jsonb end
      ) rr
      where lower(trim(rr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_diterima,
    to_jsonb(po)->'receive_record'->>'received_by_name' as diterima_oleh,
    (to_jsonb(po)->'receive_record'->>'received_at')::timestamptz as diterima_at,
    (
      select public.safe_numeric(gr->>'qty_received')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'goods_receipt'->'items') = 'array'
          then to_jsonb(po)->'goods_receipt'->'items' else '[]'::jsonb end
      ) gr
      where lower(trim(gr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_goods_receipt,
    to_jsonb(po)->'goods_receipt'->>'receiver_name' as gr_receiver,
    (to_jsonb(po)->'goods_receipt'->>'confirmed_at')::timestamptz as gr_confirmed_at,
    (to_jsonb(po)->>'full_received_at')::timestamptz as po_full_received_at,
    buyer.nama as dibuat_oleh
  from public.purchase_orders po
  cross join params p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) with ordinality as it(item, ord)
  left join public.profiles buyer on buyer.id = po.user_id
  where lower(trim(it.item->>'part_number')) = p.pn
     or (it.item->>'barang_id' ~ '^[0-9]+$'
         and (it.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1 from conv_old c
       where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
     )
     or exists (
       -- Manual link: hanya baris PO yang qty-nya sama dengan qty link
       -- (atau PO-nya cuma 1 item), supaya item lain di PO tsb tidak ikut.
       select 1
       from mr_items m
       cross join lateral json_array_elements(
         case when json_typeof(m.item->'manual_po_links') = 'array'
           then m.item->'manual_po_links' else '[]'::json end
       ) ml
       where ml->>'kode_po' = po.kode_po
         and (public.safe_numeric(ml->>'qty') = public.safe_numeric(it.item->>'qty')
              or jsonb_array_length(po.items) = 1)
     )
)
select
  l.id                                      as po_id,
  l.kode_po,
  l.match_via,
  l.created_at                              as po_created_at,
  l.updated_at                              as po_updated_at,
  l.status                                  as po_status,
  l.is_aktif,
  l.company_code,
  (to_jsonb(l)->>'is_asset')::boolean       as po_is_asset,
  l.dibuat_oleh,
  -- MR induk (purchase_orders.mr_id)
  induk.kode_mr                             as kode_mr_induk,
  induk.status                              as mr_induk_status,
  induk.department                          as mr_induk_department,
  induk.tujuan_site                         as mr_induk_site,
  induk_req.nama                            as mr_induk_requester,
  -- Semua MR yang item PN ini-nya terhubung ke PO ini
  mrx.jumlah_mr,
  mrx.daftar_mr,
  mrx.qty_diminta_di_mr,
  -- Vendor
  l.kode_vendor,
  l.vendor,
  l.vendor_details,
  -- Item
  l.item_index,
  l.item->>'part_number'                    as part_number,
  l.item->>'name'                           as item_name,
  l.qty_po,
  l.item->>'uom'                            as uom,
  l.harga                                   as harga_satuan,
  l.subtotal                                as subtotal_item,
  (
    select string_agg(format('%s - %s (%s %s @ %s)',
             coalesce(x->>'part_number', '-'), x->>'name', x->>'qty', x->>'uom', x->>'price'), E'\n')
    from jsonb_array_elements(
      case when jsonb_typeof(l.items) = 'array' then l.items else '[]'::jsonb end
    ) with ordinality as xo(x, n)
    where n <> l.item_index
  )                                         as item_lain_di_po,
  -- Nilai PO
  l.currency,
  l.discount,
  l.tax                                     as ppn,
  to_jsonb(l)->>'tax_included'              as tax_included,
  to_jsonb(l)->>'ppn_rate'                  as ppn_rate,
  l.pph_type,
  l.pph_rate,
  l.pph_amount,
  l.postage                                 as ongkir,
  l.total_price                             as total_po,
  -- Pembayaran
  l.payment_term,
  to_jsonb(l)->>'dp_bp_shipping_type'       as dp_bp_shipping_type,
  l.dp_paid,
  l.bp_paid,
  -- Penerimaan
  l.qty_diterima                            as qty_diterima_receiver,
  l.qty_po - coalesce(l.qty_diterima, 0)    as qty_belum_diterima,
  l.diterima_oleh,
  l.diterima_at,
  l.qty_goods_receipt,
  l.gr_receiver,
  l.gr_confirmed_at,
  l.po_full_received_at,
  -- Approval
  (
    select string_agg(format('%s: %s - %s (%s)', a->>'type', a->>'nama', a->>'status',
             coalesce(a->>'processed_at', '-')), E'\n')
    from jsonb_array_elements(
      case when jsonb_typeof(l.approvals) = 'array' then l.approvals else '[]'::jsonb end
    ) a
  )                                         as po_approvals,
  (
    select format('%s: %s', a->>'type', a->>'nama')
    from jsonb_array_elements(
      case when jsonb_typeof(l.approvals) = 'array' then l.approvals else '[]'::jsonb end
    ) a
    where a->>'status' = 'pending'
    limit 1
  )                                         as menunggu_approval,
  l.shipping_address,
  l.notes                                   as po_notes,
  l.item->>'description'                    as item_description,
  l.item->>'link'                           as item_link
from po_items l
left join public.material_requests induk on induk.id = l.mr_id
left join public.profiles induk_req on induk_req.id = induk.userid
left join lateral (
  select
    count(distinct m.id) as jumlah_mr,
    string_agg(
      format('%s [%s] %s / %s | qty %s %s [%s]',
             m.kode_mr, m.status, coalesce(m.requester, '-'), m.department,
             m.qty_diminta, m.item->>'uom', m.item_status),
      E'\n' order by m.created_at)  as daftar_mr,
    sum(m.qty_diminta)              as qty_diminta_di_mr
  from mr_items m
  where m.id = l.mr_id
     or l.kode_po = any(m.po_refs)
     or l.kode_po = any(m.manual_po_codes)
) mrx on true
order by l.created_at desc, l.item_index;


-- ----------------------------------------------------------------------------
-- [5] Timeline MR -> PO -> Terima (1 baris per pasangan MR-PO)
--     MR tanpa PO tetap muncul (kolom PO kosong); PO tanpa MR yang cocok juga
--     muncul (kode_mr diambil dari MR induk-nya kalau ada).
-- ----------------------------------------------------------------------------
with params as (
  select lower(trim('GA-ATK-0037')) as pn
),
barang_ids as (
  select b.id from public.barang b, params p
  where lower(trim(b.part_number)) = p.pn
),
mr_items as (
  select
    mr.*,
    o.item,
    o.ord::int as item_index,
    req.nama as requester,
    req.email as requester_email,
    case
      when lower(trim(o.item->>'part_number')) = p.pn then 'part_number'
      when o.item->>'barang_id' ~ '^[0-9]+$'
        and (o.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      else 'konversi'
    end as match_via,
    coalesce(o.item->>'status', 'Pending') as item_status,
    public.safe_numeric(o.item->>'qty') as qty_diminta,
    public.safe_numeric(o.item->>'estimasi_harga') as estimasi_harga,
    (
      select coalesce(sum(public.safe_numeric(sf->>'qty')), 0)
      from json_array_elements(
        case when json_typeof(o.item->'stock_fulfillments') = 'array'
          then o.item->'stock_fulfillments' else '[]'::json end
      ) sf
    ) as qty_stok_ga,
    array(
      select json_array_elements_text(
        case when json_typeof(o.item->'po_refs') = 'array'
          then o.item->'po_refs' else '[]'::json end
      )
    ) as po_refs,
    array(
      select ml->>'kode_po'
      from json_array_elements(
        case when json_typeof(o.item->'manual_po_links') = 'array'
          then o.item->'manual_po_links' else '[]'::json end
      ) ml
    ) as manual_po_codes
  from public.material_requests mr
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) with ordinality as o(item, ord)
  left join public.profiles req on req.id = mr.userid
  where lower(trim(o.item->>'part_number')) = p.pn
     or (o.item->>'barang_id' ~ '^[0-9]+$'
         and (o.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1
       from json_array_elements(
         case when json_typeof(o.item->'conversion_history') = 'array'
           then o.item->'conversion_history' else '[]'::json end
       ) ch
       where lower(trim(ch->>'from_part_number')) = p.pn
          or lower(trim(ch->>'to_part_number')) = p.pn
     )
),
conv_old as (
  select distinct lower(trim(ch->>'from_part_number')) as old_pn, k.kode_po
  from mr_items m
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(m.item->'conversion_history') = 'array'
      then m.item->'conversion_history' else '[]'::json end
  ) ch
  cross join lateral json_array_elements_text(
    case when json_typeof(ch->'kept_old_po_kode') = 'array'
      then ch->'kept_old_po_kode' else '[]'::json end
  ) as k(kode_po)
  where lower(trim(ch->>'to_part_number')) = p.pn
),
po_items as (
  select
    po.*,
    it.item,
    it.ord::int as item_index,
    case
      when lower(trim(it.item->>'part_number')) = p.pn then 'part_number'
      when it.item->>'barang_id' ~ '^[0-9]+$'
        and (it.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      when exists (
        select 1 from conv_old c
        where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
      ) then 'konversi (PN lama)'
      else 'manual link MR'
    end as match_via,
    po.status not in ('Draft', 'Rejected', 'Cancelled', 'Canceled') as is_aktif,
    coalesce(nullif(trim(po.vendor_details->>'nama_vendor'), ''),
             nullif(trim(po.vendor_details->>'name'), ''),
             nullif(trim(it.item->>'vendor_name'), '')) as vendor,
    po.vendor_details->>'kode_vendor' as kode_vendor,
    public.safe_numeric(it.item->>'qty') as qty_po,
    public.safe_numeric(it.item->>'price') as harga,
    coalesce(public.safe_numeric(it.item->>'total_price'),
             public.safe_numeric(it.item->>'qty') * public.safe_numeric(it.item->>'price')) as subtotal,
    (
      select public.safe_numeric(rr->>'received_qty')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'receive_record'->'items') = 'array'
          then to_jsonb(po)->'receive_record'->'items' else '[]'::jsonb end
      ) rr
      where lower(trim(rr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_diterima,
    to_jsonb(po)->'receive_record'->>'received_by_name' as diterima_oleh,
    (to_jsonb(po)->'receive_record'->>'received_at')::timestamptz as diterima_at,
    (
      select public.safe_numeric(gr->>'qty_received')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'goods_receipt'->'items') = 'array'
          then to_jsonb(po)->'goods_receipt'->'items' else '[]'::jsonb end
      ) gr
      where lower(trim(gr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_goods_receipt,
    to_jsonb(po)->'goods_receipt'->>'receiver_name' as gr_receiver,
    (to_jsonb(po)->'goods_receipt'->>'confirmed_at')::timestamptz as gr_confirmed_at,
    (to_jsonb(po)->>'full_received_at')::timestamptz as po_full_received_at,
    buyer.nama as dibuat_oleh
  from public.purchase_orders po
  cross join params p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) with ordinality as it(item, ord)
  left join public.profiles buyer on buyer.id = po.user_id
  where lower(trim(it.item->>'part_number')) = p.pn
     or (it.item->>'barang_id' ~ '^[0-9]+$'
         and (it.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1 from conv_old c
       where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
     )
     or exists (
       -- Manual link: hanya baris PO yang qty-nya sama dengan qty link
       -- (atau PO-nya cuma 1 item), supaya item lain di PO tsb tidak ikut.
       select 1
       from mr_items m
       cross join lateral json_array_elements(
         case when json_typeof(m.item->'manual_po_links') = 'array'
           then m.item->'manual_po_links' else '[]'::json end
       ) ml
       where ml->>'kode_po' = po.kode_po
         and (public.safe_numeric(ml->>'qty') = public.safe_numeric(it.item->>'qty')
              or jsonb_array_length(po.items) = 1)
     )
),
pairs as (
  select
    m.kode_mr, m.created_at as mr_created_at, m.status as mr_status, m.requester,
    m.department, m.tujuan_site, m.item_status, m.qty_diminta, m.estimasi_harga,
    m.qty_stok_ga,
    pi.kode_po, pi.match_via as po_match_via, pi.created_at as po_created_at,
    pi.status as po_status, pi.dibuat_oleh as po_dibuat_oleh, pi.vendor,
    pi.item->>'part_number' as po_part_number,
    pi.qty_po, pi.harga, pi.subtotal, pi.total_price as total_po, pi.payment_term,
    pi.qty_diterima, pi.diterima_oleh,
    coalesce(pi.po_full_received_at, pi.diterima_at) as diterima_at
  from mr_items m
  left join po_items pi
    on pi.mr_id = m.id
    or pi.kode_po = any(m.po_refs)
    or pi.kode_po = any(m.manual_po_codes)
  union all
  select
    induk.kode_mr, induk.created_at, induk.status, induk_req.nama,
    induk.department, induk.tujuan_site, '(item PN ini tidak ada di MR)', null, null,
    null,
    pi.kode_po, pi.match_via, pi.created_at,
    pi.status, pi.dibuat_oleh, pi.vendor,
    pi.item->>'part_number',
    pi.qty_po, pi.harga, pi.subtotal, pi.total_price, pi.payment_term,
    pi.qty_diterima, pi.diterima_oleh,
    coalesce(pi.po_full_received_at, pi.diterima_at)
  from po_items pi
  left join public.material_requests induk on induk.id = pi.mr_id
  left join public.profiles induk_req on induk_req.id = induk.userid
  where not exists (
    select 1 from mr_items m
    where pi.mr_id = m.id
       or pi.kode_po = any(m.po_refs)
       or pi.kode_po = any(m.manual_po_codes)
  )
)
select
  *,
  round((extract(epoch from (po_created_at - mr_created_at)) / 86400)::numeric, 1) as hari_mr_ke_po,
  round((extract(epoch from (diterima_at - po_created_at)) / 86400)::numeric, 1)   as hari_po_ke_terima,
  round((extract(epoch from (diterima_at - mr_created_at)) / 86400)::numeric, 1)   as hari_mr_ke_terima
from pairs
order by coalesce(mr_created_at, po_created_at) desc, kode_mr, po_created_at;


-- ----------------------------------------------------------------------------
-- [6] Ringkasan per status / vendor + daftar nomor MR & PO
-- ----------------------------------------------------------------------------
with params as (
  select lower(trim('GA-ATK-0037')) as pn
),
barang_ids as (
  select b.id from public.barang b, params p
  where lower(trim(b.part_number)) = p.pn
),
mr_items as (
  select
    mr.*,
    o.item,
    o.ord::int as item_index,
    req.nama as requester,
    req.email as requester_email,
    case
      when lower(trim(o.item->>'part_number')) = p.pn then 'part_number'
      when o.item->>'barang_id' ~ '^[0-9]+$'
        and (o.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      else 'konversi'
    end as match_via,
    coalesce(o.item->>'status', 'Pending') as item_status,
    public.safe_numeric(o.item->>'qty') as qty_diminta,
    public.safe_numeric(o.item->>'estimasi_harga') as estimasi_harga,
    (
      select coalesce(sum(public.safe_numeric(sf->>'qty')), 0)
      from json_array_elements(
        case when json_typeof(o.item->'stock_fulfillments') = 'array'
          then o.item->'stock_fulfillments' else '[]'::json end
      ) sf
    ) as qty_stok_ga,
    array(
      select json_array_elements_text(
        case when json_typeof(o.item->'po_refs') = 'array'
          then o.item->'po_refs' else '[]'::json end
      )
    ) as po_refs,
    array(
      select ml->>'kode_po'
      from json_array_elements(
        case when json_typeof(o.item->'manual_po_links') = 'array'
          then o.item->'manual_po_links' else '[]'::json end
      ) ml
    ) as manual_po_codes
  from public.material_requests mr
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) with ordinality as o(item, ord)
  left join public.profiles req on req.id = mr.userid
  where lower(trim(o.item->>'part_number')) = p.pn
     or (o.item->>'barang_id' ~ '^[0-9]+$'
         and (o.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1
       from json_array_elements(
         case when json_typeof(o.item->'conversion_history') = 'array'
           then o.item->'conversion_history' else '[]'::json end
       ) ch
       where lower(trim(ch->>'from_part_number')) = p.pn
          or lower(trim(ch->>'to_part_number')) = p.pn
     )
),
conv_old as (
  select distinct lower(trim(ch->>'from_part_number')) as old_pn, k.kode_po
  from mr_items m
  cross join params p
  cross join lateral json_array_elements(
    case when json_typeof(m.item->'conversion_history') = 'array'
      then m.item->'conversion_history' else '[]'::json end
  ) ch
  cross join lateral json_array_elements_text(
    case when json_typeof(ch->'kept_old_po_kode') = 'array'
      then ch->'kept_old_po_kode' else '[]'::json end
  ) as k(kode_po)
  where lower(trim(ch->>'to_part_number')) = p.pn
),
po_items as (
  select
    po.*,
    it.item,
    it.ord::int as item_index,
    case
      when lower(trim(it.item->>'part_number')) = p.pn then 'part_number'
      when it.item->>'barang_id' ~ '^[0-9]+$'
        and (it.item->>'barang_id')::bigint in (select id from barang_ids) then 'barang_id'
      when exists (
        select 1 from conv_old c
        where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
      ) then 'konversi (PN lama)'
      else 'manual link MR'
    end as match_via,
    po.status not in ('Draft', 'Rejected', 'Cancelled', 'Canceled') as is_aktif,
    coalesce(nullif(trim(po.vendor_details->>'nama_vendor'), ''),
             nullif(trim(po.vendor_details->>'name'), ''),
             nullif(trim(it.item->>'vendor_name'), '')) as vendor,
    po.vendor_details->>'kode_vendor' as kode_vendor,
    public.safe_numeric(it.item->>'qty') as qty_po,
    public.safe_numeric(it.item->>'price') as harga,
    coalesce(public.safe_numeric(it.item->>'total_price'),
             public.safe_numeric(it.item->>'qty') * public.safe_numeric(it.item->>'price')) as subtotal,
    (
      select public.safe_numeric(rr->>'received_qty')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'receive_record'->'items') = 'array'
          then to_jsonb(po)->'receive_record'->'items' else '[]'::jsonb end
      ) rr
      where lower(trim(rr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_diterima,
    to_jsonb(po)->'receive_record'->>'received_by_name' as diterima_oleh,
    (to_jsonb(po)->'receive_record'->>'received_at')::timestamptz as diterima_at,
    (
      select public.safe_numeric(gr->>'qty_received')
      from jsonb_array_elements(
        case when jsonb_typeof(to_jsonb(po)->'goods_receipt'->'items') = 'array'
          then to_jsonb(po)->'goods_receipt'->'items' else '[]'::jsonb end
      ) gr
      where lower(trim(gr->>'part_number')) = lower(trim(it.item->>'part_number'))
      limit 1
    ) as qty_goods_receipt,
    to_jsonb(po)->'goods_receipt'->>'receiver_name' as gr_receiver,
    (to_jsonb(po)->'goods_receipt'->>'confirmed_at')::timestamptz as gr_confirmed_at,
    (to_jsonb(po)->>'full_received_at')::timestamptz as po_full_received_at,
    buyer.nama as dibuat_oleh
  from public.purchase_orders po
  cross join params p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) with ordinality as it(item, ord)
  left join public.profiles buyer on buyer.id = po.user_id
  where lower(trim(it.item->>'part_number')) = p.pn
     or (it.item->>'barang_id' ~ '^[0-9]+$'
         and (it.item->>'barang_id')::bigint in (select id from barang_ids))
     or exists (
       select 1 from conv_old c
       where c.kode_po = po.kode_po and c.old_pn = lower(trim(it.item->>'part_number'))
     )
     or exists (
       -- Manual link: hanya baris PO yang qty-nya sama dengan qty link
       -- (atau PO-nya cuma 1 item), supaya item lain di PO tsb tidak ikut.
       select 1
       from mr_items m
       cross join lateral json_array_elements(
         case when json_typeof(m.item->'manual_po_links') = 'array'
           then m.item->'manual_po_links' else '[]'::json end
       ) ml
       where ml->>'kode_po' = po.kode_po
         and (public.safe_numeric(ml->>'qty') = public.safe_numeric(it.item->>'qty')
              or jsonb_array_length(po.items) = 1)
     )
),
po_pn as (
  select * from po_items
)
select * from (
  select 'MR per status MR' as grup, status as kunci,
         count(distinct id) as jumlah_dokumen, count(*) as jumlah_baris,
         sum(qty_diminta) as total_qty,
         null::numeric as harga_min, null::numeric as harga_max, null::numeric as harga_avg,
         sum(qty_diminta * estimasi_harga) as total_nilai,
         (array_agg(kode_mr order by created_at desc))[1] as dokumen_terakhir,
         max(created_at) as terakhir,
         string_agg(distinct kode_mr, ', ') as daftar_dokumen
  from mr_items group by status
  union all
  select 'MR per status item', item_status,
         count(distinct id), count(*), sum(qty_diminta),
         null, null, null, sum(qty_diminta * estimasi_harga),
         (array_agg(kode_mr order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_mr, ', ')
  from mr_items group by item_status
  union all
  select 'MR per departemen', department,
         count(distinct id), count(*), sum(qty_diminta),
         null, null, null, sum(qty_diminta * estimasi_harga),
         (array_agg(kode_mr order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_mr, ', ')
  from mr_items group by department
  union all
  select 'PO per status', status,
         count(distinct id), count(*), sum(qty_po),
         min(harga) filter (where harga > 0), max(harga), round(avg(harga), 2), sum(subtotal),
         (array_agg(kode_po order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_po, ', ')
  from po_pn group by status
  union all
  select 'PO aktif per vendor', coalesce(vendor, '(tanpa vendor)'),
         count(distinct id), count(*), sum(qty_po),
         min(harga) filter (where harga > 0), max(harga), round(avg(harga), 2), sum(subtotal),
         (array_agg(kode_po order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_po, ', ')
  from po_pn where is_aktif group by vendor
  union all
  select 'PO aktif per tahun', extract(year from created_at)::text,
         count(distinct id), count(*), sum(qty_po),
         min(harga) filter (where harga > 0), max(harga), round(avg(harga), 2), sum(subtotal),
         (array_agg(kode_po order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_po, ', ')
  from po_pn where is_aktif group by extract(year from created_at)
  union all
  select 'TOTAL PO aktif',
         'harga terakhir: ' || coalesce(
           (array_agg(harga order by created_at desc) filter (where harga > 0))[1]::text, '-'),
         count(distinct id), count(*), sum(qty_po),
         min(harga) filter (where harga > 0), max(harga), round(avg(harga), 2), sum(subtotal),
         (array_agg(kode_po order by created_at desc))[1], max(created_at),
         string_agg(distinct kode_po, ', ')
  from po_pn where is_aktif
) s
order by grup, terakhir desc nulls last;
