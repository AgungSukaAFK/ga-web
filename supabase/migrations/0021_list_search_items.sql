-- 0021_list_search_items.sql
--
-- Search di halaman list MR & PO ikut mencari barang di dalam dokumen. Barang
-- ada di kolom JSON (`orders` / `items`) yang tidak bisa difilter ilike
-- langsung lewat PostgREST, jadi dibuat computed field: PostgREST menganggap
-- function ini seperti kolom, sehingga bisa dipakai di `.or()` bersama filter
-- & pagination halaman list (MaterialRequestClient.tsx,
-- purchase-order/page.tsx).
--
-- Jalankan SEKALI lewat SQL Editor Supabase (project utama), SEBELUM kode
-- yang memakainya dideploy - tanpa function ini search di kedua halaman
-- error. Script IDEMPOTENT.

create or replace function public.mr_items_search_text(mr public.material_requests)
returns text
language sql
stable
as $$
  select coalesce(
    string_agg(concat_ws(' ', o ->> 'name', o ->> 'part_number', o ->> 'note'), ' '),
    ''
  )
  from json_array_elements(
    case when json_typeof(mr.orders) = 'array' then mr.orders else '[]'::json end
  ) as o;
$$;

create or replace function public.po_items_search_text(po public.purchase_orders)
returns text
language sql
stable
as $$
  select coalesce(
    string_agg(concat_ws(' ', i ->> 'name', i ->> 'part_number', i ->> 'description'), ' '),
    ''
  )
  from jsonb_array_elements(
    case when jsonb_typeof(po.items) = 'array' then po.items else '[]'::jsonb end
  ) as i;
$$;

grant execute on function public.mr_items_search_text(public.material_requests) to authenticated;
grant execute on function public.po_items_search_text(public.purchase_orders) to authenticated;

notify pgrst, 'reload schema';
