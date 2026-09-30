-- "History Vendor" per item di halaman Buat PO (tabel "Pilih Item dari
-- Material Request") - RPC `get_item_vendor_history` untuk merangkum vendor
-- mana saja yang pernah dipakai membeli tiap barang. Dipakai
-- fetchItemVendorHistory di services/itemVendorHistoryService.ts.
--
-- Dibuat sebagai RPC karena perlu agregasi di dalam kolom `items` PO (jsonb
-- array) & `orders` MR (json array). SEMUA item 1 MR dikirim sekaligus
-- (p_items) jadi cukup 1 query per buka halaman, bukan 1 query per item.
--
-- Barang dicocokkan lewat barang_id, atau part_number (case-insensitive)
-- kalau barang_id tidak ada / beda (data lama, barang substitusi).
--
-- Yang dihitung hanya yang sukses/berjalan:
--   - PO: status selain Rejected / Cancelled / Draft.
--   - MR: status selain Rejected / Cancelled, dan item-nya sendiri bukan
--     Cancelled / Replaced.
-- "Dibeli" = PO yang barangnya sudah diterima (Partial Receive, Full
-- Received, atau Completed - status lama).
--
-- security invoker: tetap tunduk ke RLS purchase_orders/material_requests
-- milik pemanggil.
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama).

-- Cast teks -> numeric yang aman (qty/price di json kadang string kosong
-- atau format aneh dari data lama) - hasil null kalau bukan angka.
create or replace function public.safe_numeric(p_value text)
returns numeric
language sql
immutable
as $$
  select case
    when trim(coalesce(p_value, '')) ~ '^-?[0-9]+(\.[0-9]+)?$'
      then trim(p_value)::numeric
    else null
  end;
$$;

create or replace function public.get_item_vendor_history(
  p_items jsonb,
  p_exclude_mr_id bigint default null
)
returns table (
  item_key text,
  mr_request_count int,
  vendors jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with inp as (
    select distinct on (e->>'key')
      e->>'key' as k,
      case when e->>'barang_id' ~ '^[0-9]+$' then (e->>'barang_id')::bigint end as bid,
      nullif(lower(trim(e->>'part_number')), '') as pn
    from jsonb_array_elements(
      case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end
    ) as e
    where coalesce(e->>'key', '') <> ''
    limit 300
  ),
  po_lines as (
    select
      i.k,
      po.id as po_id,
      po.kode_po,
      po.mr_id,
      po.status,
      po.created_at,
      case when po.vendor_details->>'vendor_id' ~ '^[0-9]+$'
        then (po.vendor_details->>'vendor_id')::bigint end as vid,
      nullif(trim(po.vendor_details->>'kode_vendor'), '') as kode,
      coalesce(
        nullif(trim(po.vendor_details->>'nama_vendor'), ''),
        nullif(trim(po.vendor_details->>'name'), ''),
        nullif(trim(it->>'vendor_name'), '')
      ) as vname,
      coalesce(public.safe_numeric(it->>'qty'), 0) as qty,
      public.safe_numeric(it->>'price') as price,
      nullif(trim(it->>'uom'), '') as uom
    from public.purchase_orders po
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
    ) as it
    join inp i
      on (i.bid is not null and it->>'barang_id' ~ '^[0-9]+$' and (it->>'barang_id')::bigint = i.bid)
      or (i.pn is not null and lower(trim(it->>'part_number')) = i.pn)
    where po.status not in ('Rejected', 'Cancelled', 'Canceled', 'Draft')
  ),
  po_keyed as (
    -- 1 vendor = vendor_id kalau ada, fallback nama (PO lama tanpa vendor_id).
    select *, coalesce(vid::text, 'n:' || lower(vname)) as vkey
    from po_lines
    where vid is not null or vname is not null
  ),
  vendor_agg as (
    select
      k,
      vkey,
      max(vid) as vendor_id,
      (array_agg(kode order by created_at desc) filter (where kode is not null))[1] as kode_vendor,
      (array_agg(vname order by created_at desc) filter (where vname is not null))[1] as nama_vendor,
      count(distinct po_id)::int as po_count,
      count(distinct po_id) filter (
        where status in ('Partial Receive', 'Full Received', 'Completed')
      )::int as bought_count,
      count(distinct mr_id)::int as mr_count,
      sum(qty) as total_qty,
      (array_agg(price order by created_at desc) filter (where price is not null and price > 0))[1] as last_price,
      min(price) filter (where price > 0) as min_price,
      max(price) filter (where price > 0) as max_price,
      (array_agg(uom order by created_at desc) filter (where uom is not null))[1] as uom,
      (array_agg(kode_po order by created_at desc))[1] as last_kode_po,
      max(created_at) as last_po_at
    from po_keyed
    group by k, vkey
  ),
  mr_req as (
    select i.k, count(distinct mr.id)::int as cnt
    from public.material_requests mr
    cross join lateral json_array_elements(
      case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
    ) as o
    join inp i
      on (i.bid is not null and o->>'barang_id' ~ '^[0-9]+$' and (o->>'barang_id')::bigint = i.bid)
      or (i.pn is not null and lower(trim(o->>'part_number')) = i.pn)
    where mr.status not in ('Rejected', 'Cancelled', 'Canceled')
      and coalesce(o->>'status', '') not in ('Cancelled', 'Replaced')
      and (p_exclude_mr_id is null or mr.id <> p_exclude_mr_id)
    group by i.k
  )
  select
    i.k as item_key,
    coalesce(m.cnt, 0) as mr_request_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'vendor_id', v.vendor_id,
            'kode_vendor', v.kode_vendor,
            'nama_vendor', v.nama_vendor,
            'po_count', v.po_count,
            'bought_count', v.bought_count,
            'mr_count', v.mr_count,
            'total_qty', v.total_qty,
            'uom', v.uom,
            'last_price', v.last_price,
            'min_price', v.min_price,
            'max_price', v.max_price,
            'last_kode_po', v.last_kode_po,
            'last_po_at', v.last_po_at
          )
          order by v.po_count desc, v.last_po_at desc
        )
        from vendor_agg v
        where v.k = i.k
      ),
      '[]'::jsonb
    ) as vendors
  from inp i
  left join mr_req m on m.k = i.k;
$$;

grant execute on function public.safe_numeric(text) to authenticated;
grant execute on function public.get_item_vendor_history(jsonb, bigint) to authenticated;
